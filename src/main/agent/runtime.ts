import { createDeepAgent } from "deepagents"
import { getDefaultModel } from "../ipc/models"
import { getApiKey, getBaseUrl, getThreadCheckpointPath } from "../storage"
import { ChatOpenAI } from "@langchain/openai"
import { SqlJsSaver } from "../checkpointer/sqljs-saver"
import { LocalSandbox } from "./local-sandbox"
import createDebug from "debug"

const debug = createDebug("omni:runtime")

import type * as _lcTypes from "langchain"
import type * as _lcMessages from "@langchain/core/messages"
import type * as _lcLanggraph from "@langchain/langgraph"
import type * as _lcZodTypes from "@langchain/core/utils/types"

import { BASE_SYSTEM_PROMPT } from "./system-prompt"

/**
 * Generate the full system prompt for the agent.
 *
 * @param workspacePath - The workspace path the agent is operating in
 * @returns The complete system prompt
 */
function getSystemPrompt(workspacePath: string): string {
  const workingDirSection = `
### File System and Paths

**IMPORTANT - Path Handling:**
- All file paths use fully qualified absolute system paths
- The workspace root is: \`${workspacePath}\`
- Example: \`${workspacePath}/src/index.ts\`, \`${workspacePath}/README.md\`
- To list the workspace root, use \`ls("${workspacePath}")\`
- Always use full absolute paths for all file operations
`

  return workingDirSection + BASE_SYSTEM_PROMPT
}

// Per-thread checkpointer cache
const checkpointers = new Map<string, SqlJsSaver>()

export async function getCheckpointer(threadId: string): Promise<SqlJsSaver> {
  let checkpointer = checkpointers.get(threadId)
  if (!checkpointer) {
    const dbPath = getThreadCheckpointPath(threadId)
    checkpointer = new SqlJsSaver(dbPath)
    await checkpointer.initialize()
    checkpointers.set(threadId, checkpointer)
  }
  return checkpointer
}

export async function closeCheckpointer(threadId: string): Promise<void> {
  const checkpointer = checkpointers.get(threadId)
  if (checkpointer) {
    await checkpointer.close()
    checkpointers.delete(threadId)
  }
}

function getModelInstance(modelId?: string): ChatOpenAI | string {
  const model = modelId || getDefaultModel()
  console.log("[Runtime] Using model:", model)

  const apiKey = getApiKey("openai")
  debug("[Runtime] OpenAI API key present:", !!apiKey)
  if (!apiKey) {
    throw new Error("OpenAI API key not configured")
  }

  const baseUrl = getBaseUrl("openai")
  return new ChatOpenAI({
    model,
    apiKey,
    ...(baseUrl ? { configuration: { baseURL: baseUrl } } : {})
  })
}

import { RemoteGraph } from "@langchain/langgraph/remote"
import type { RemoteAgentConfig } from "../types"
import { isReady } from "../webllm/broker"
import { WebLLMLesserAgentRunnable } from "../webllm/subagent"

export interface CreateAgentRuntimeOptions {
  /** Thread ID - REQUIRED for per-thread checkpointing */
  threadId: string
  /** Model ID to use (defaults to configured default model) */
  modelId?: string
  /** Workspace path - REQUIRED for agent to operate on files */
  workspacePath: string
  agentEndpoints?: RemoteAgentConfig[]
  /** WebContents ID of the renderer window, used to gate lesser agent availability */
  webContentsId?: number
}

// Create agent runtime with configured model and checkpointer
export type AgentRuntime = ReturnType<typeof createDeepAgent>

export async function createAgentRuntime(options: CreateAgentRuntimeOptions) {
  const { threadId, modelId, workspacePath, agentEndpoints, webContentsId } = options

  if (!threadId) {
    throw new Error("Thread ID is required for checkpointing.")
  }

  if (!workspacePath) {
    throw new Error(
      "Workspace path is required. Please select a workspace folder before running the agent."
    )
  }

  debug("[Runtime] Creating agent runtime...")
  debug("[Runtime] Thread ID:", threadId)
  debug("[Runtime] Workspace path:", workspacePath)

  const model = await getModelInstance(modelId)
  debug("[Runtime] Model instance created:", typeof model)

  const checkpointer = await getCheckpointer(threadId)
  debug("[Runtime] Checkpointer ready for thread:", threadId)

  const backend = new LocalSandbox({
    rootDir: workspacePath,
    virtualMode: false, // Use absolute system paths for consistency with shell commands
    timeout: 120_000, // 2 minutes
    maxOutputBytes: 100_000 // ~100KB
  })

  const systemPrompt = getSystemPrompt(workspacePath)

  // Custom filesystem prompt for absolute paths (matches virtualMode: false)
  const filesystemSystemPrompt = `You have access to a filesystem. All file paths use fully qualified absolute system paths.

- ls: list files in a directory (e.g., ls("${workspacePath}"))
- read_file: read a file from the filesystem
- write_file: write to a file in the filesystem
- edit_file: edit a file in the filesystem
- glob: find files matching a pattern (e.g., "**/*.py")
- grep: search for text within files

The workspace root is: ${workspacePath}`

  const subagents = (agentEndpoints ?? []).map((ep) => ({
    name: ep.name,
    description: `Remote LangGraph agent: ${ep.name} at ${ep.url}`,
    runnable: new RemoteGraph({
      graphId: ep.graphId ?? "agent",
      url: ep.url,
      ...(ep.apiKey ? { apiKey: ep.apiKey } : {})
    })
  }))

  // Append the built-in Hermes lesser agent only when the renderer window's worker is ready
  if (webContentsId !== undefined && isReady(webContentsId)) {
    debug("[Runtime] Hermes lesser agent is ready, appending to subagents")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(subagents as any[]).push({
      name: "hermes-lesser-agent",
      description:
        "A lightweight local AI (Hermes-2-Pro-Llama-3-8B running in WebLLM) for summarization and lightweight tasks. Invoke with: <task>your task</task><allowed_tools>tool1,tool2</allowed_tools>",
      runnable: new WebLLMLesserAgentRunnable(webContentsId, workspacePath)
    })
  }

  const agent = createDeepAgent({
    model,
    checkpointer,
    backend,
    systemPrompt,
    // Custom filesystem prompt for absolute paths (requires deepagents update)
    filesystemSystemPrompt,
    // Require human approval for all shell commands
    interruptOn: { execute: true },
    subagents
  } as Parameters<typeof createDeepAgent>[0])

  debug("[Runtime] Deep agent created with LocalSandbox at:", workspacePath)
  return agent
}

export type DeepAgent = ReturnType<typeof createDeepAgent>

// Clean up all checkpointer resources
export async function closeRuntime(): Promise<void> {
  const closePromises = Array.from(checkpointers.values()).map((cp) => cp.close())
  await Promise.all(closePromises)
  checkpointers.clear()
}
