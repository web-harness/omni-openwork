/**
 * Tool registry: maps tool names to JSON schemas and Node.js executors.
 * The lesser agent can only use tools that appear here.
 * The main agent decides which subset to expose per invocation.
 */

import { promises as fsp } from "fs"
import { join } from "path"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolExecutor {
  schema: ToolSchema
  execute: (args: Record<string, unknown>, workspacePath: string) => Promise<string>
}

const registry = new Map<string, ToolExecutor>()

function register(executor: ToolExecutor): void {
  registry.set(executor.schema.name, executor)
}

// ---------------------------------------------------------------------------
// read_file
// ---------------------------------------------------------------------------
register({
  schema: {
    name: "read_file",
    description: "Read the content of a file at the given absolute path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file" },
        offset: { type: "number", description: "Line offset to start reading from (0-based)" },
        limit: { type: "number", description: "Maximum number of lines to read" }
      },
      required: ["path"]
    }
  },
  execute: async (args, _workspacePath) => {
    const filePath = String(args.path)
    const content = await fsp.readFile(filePath, "utf-8")
    const lines = content.split("\n")
    const offset = typeof args.offset === "number" ? args.offset : 0
    const limit = typeof args.limit === "number" ? args.limit : lines.length
    return lines.slice(offset, offset + limit).join("\n")
  }
})

// ---------------------------------------------------------------------------
// ls
// ---------------------------------------------------------------------------
register({
  schema: {
    name: "ls",
    description: "List files and directories in a directory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the directory" }
      },
      required: ["path"]
    }
  },
  execute: async (args, workspacePath) => {
    const dirPath = args.path ? String(args.path) : workspacePath
    const entries = await fsp.readdir(dirPath, { withFileTypes: true })
    return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join("\n")
  }
})

// ---------------------------------------------------------------------------
// glob
// ---------------------------------------------------------------------------
register({
  schema: {
    name: "glob",
    description: "Find files matching a glob pattern (supports * and ** wildcards).",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (e.g. '**/*.ts')" },
        cwd: { type: "string", description: "Directory to search from (defaults to workspace)" }
      },
      required: ["pattern"]
    }
  },
  execute: async (args, workspacePath) => {
    const pattern = String(args.pattern)
    const cwd = args.cwd ? String(args.cwd) : workspacePath
    const matches: string[] = []

    // Simple glob: convert pattern to regex and walk directory
    const parts = pattern.split("/")
    const walkDir = async (dir: string, remainingParts: string[]): Promise<void> => {
      if (remainingParts.length === 0) return
      const [head, ...rest] = remainingParts

      if (head === "**") {
        // Match zero or more directories
        await walkDir(dir, rest)
        const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])
        for (const entry of entries) {
          if (entry.isDirectory()) {
            await walkDir(join(dir, entry.name), remainingParts)
          }
        }
        return
      }

      const regexStr = "^" + head.replace(/\./g, "\\.").replace(/\*/g, "[^/]*") + "$"
      const regex = new RegExp(regexStr)
      const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (!regex.test(entry.name)) continue
        if (rest.length === 0 && entry.isFile()) {
          matches.push(join(dir, entry.name))
        } else if (rest.length > 0 && entry.isDirectory()) {
          await walkDir(join(dir, entry.name), rest)
        }
      }
    }

    await walkDir(cwd, parts)
    return matches.join("\n") || "(no matches)"
  }
})

// ---------------------------------------------------------------------------
// grep
// ---------------------------------------------------------------------------
register({
  schema: {
    name: "grep",
    description: "Search for text in files.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Text or regex pattern to search for" },
        path: { type: "string", description: "File or directory path to search in" },
        recursive: { type: "boolean", description: "Search recursively (default: true)" }
      },
      required: ["pattern", "path"]
    }
  },
  execute: async (args, _workspacePath) => {
    const pattern = String(args.pattern)
    const searchPath = String(args.path)
    const results: string[] = []

    const searchFile = async (filePath: string): Promise<void> => {
      try {
        const content = await fsp.readFile(filePath, "utf-8")
        const lines = content.split("\n")
        const regex = new RegExp(pattern, "gi")
        lines.forEach((line, i) => {
          if (regex.test(line)) {
            results.push(`${filePath}:${i + 1}: ${line}`)
          }
          regex.lastIndex = 0
        })
      } catch {
        // Skip unreadable files
      }
    }

    const stat = await fsp.stat(searchPath).catch(() => null)
    if (!stat) return "(path not found)"

    if (stat.isFile()) {
      await searchFile(searchPath)
    } else if (stat.isDirectory()) {
      const walk = async (dir: string): Promise<void> => {
        const entries = await fsp.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = join(dir, entry.name)
          if (entry.isDirectory() && args.recursive !== false) {
            await walk(full)
          } else if (entry.isFile()) {
            await searchFile(full)
          }
        }
      }
      await walk(searchPath)
    }

    return results.slice(0, 200).join("\n") || "(no matches)"
  }
})

// ---------------------------------------------------------------------------
// write_file
// ---------------------------------------------------------------------------
register({
  schema: {
    name: "write_file",
    description: "Write content to a file (creates or overwrites).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["path", "content"]
    }
  },
  execute: async (args, _workspacePath) => {
    const filePath = String(args.path)
    const content = String(args.content)
    await fsp.writeFile(filePath, content, "utf-8")
    return `Written ${content.length} bytes to ${filePath}`
  }
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getToolSchema(name: string): ToolSchema | undefined {
  return registry.get(name)?.schema
}

export function getAllToolSchemas(): ToolSchema[] {
  return Array.from(registry.values()).map((e) => e.schema)
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  workspacePath: string
): Promise<string> {
  const executor = registry.get(name)
  if (!executor) throw new Error(`Unknown tool: ${name}`)
  return executor.execute(args, workspacePath)
}

export function toolSchemaForAllowedNames(names: string[]): ToolSchema[] {
  return names.flatMap((n) => {
    const schema = getToolSchema(n)
    return schema ? [schema] : []
  })
}
