/**
 * WebLLM lesser agent Runnable for LangChain/deepagents.
 *
 * Delegates tasks to the renderer-side Hermes worker via IPC.
 * Appended to the subagents array only when the broker reports ready.
 */

import { Runnable, type RunnableConfig } from "@langchain/core/runnables"
import createDebug from "debug"
import { randomUUID } from "crypto"
import { invokeLesserAgent } from "./broker"
import { toolSchemaForAllowedNames, getAllToolSchemas } from "./tool-registry"
import type { WebLLMAllowedTool } from "../../types"

const debug = createDebug("omni:webllm:subagent")

// Parse task and allowed tools from the structured input the main agent sends.
// Expected format:
//   <task>description</task>
//   <allowed_tools>tool1,tool2</allowed_tools>
//
// If no <allowed_tools> tag, exposes all registered tools.
function parseInput(raw: string): { task: string; allowedTools: WebLLMAllowedTool[] } {
  const taskMatch = /<task>([\s\S]*?)<\/task>/i.exec(raw)
  const toolsMatch = /<allowed_tools>([\s\S]*?)<\/allowed_tools>/i.exec(raw)

  const task = taskMatch ? taskMatch[1].trim() : raw.trim()
  const toolNames = toolsMatch
    ? toolsMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const schemas = toolNames.length > 0 ? toolSchemaForAllowedNames(toolNames) : getAllToolSchemas()
  const allowedTools: WebLLMAllowedTool[] = schemas.map((s) => ({
    name: s.name,
    description: s.description,
    parameters: s.parameters
  }))

  return { task, allowedTools }
}

export class WebLLMLesserAgentRunnable extends Runnable<unknown, unknown> {
  lc_namespace = ["omni", "webllm"]

  constructor(
    private readonly webContentsId: number,
    private readonly workspacePath: string
  ) {
    super()
  }

  async invoke(input: unknown, _config?: RunnableConfig): Promise<unknown> {
    // deepagents passes the task as a string or object with messages
    let rawInput: string
    if (typeof input === "string") {
      rawInput = input
    } else if (input && typeof input === "object" && "messages" in input) {
      const msgs = (input as { messages: unknown[] }).messages
      const last = msgs[msgs.length - 1]
      rawInput = typeof last === "string" ? last : JSON.stringify(last)
    } else {
      rawInput = JSON.stringify(input)
    }

    const { task, allowedTools } = parseInput(rawInput)
    const invokeId = randomUUID()

    debug(
      "[Subagent] Invoking for task:",
      task.substring(0, 60),
      "tools:",
      allowedTools.map((t) => t.name)
    )

    const result = await invokeLesserAgent(
      this.webContentsId,
      { task, allowedTools, workspacePath: this.workspacePath },
      invokeId
    )

    return result
  }
}
