import createDebug from "debug"
import {
  CreateWebWorkerMLCEngine,
  type MLCEngineInterface,
  type InitProgressReport,
  type ChatCompletionMessageParam
} from "@mlc-ai/web-llm"
import {
  WEBLLM_MODEL_ID,
  type WebLLMStatus,
  type WebLLMInvokePayload,
  type WebLLMToolResult
} from "../../../../types"

const debug = createDebug("omni:webllm:manager")

const MAX_TOOL_ROUNDS = 16

function buildHermesSystemPrompt(tools: WebLLMInvokePayload["allowedTools"]): string {
  if (tools.length === 0) {
    return "You are a helpful AI assistant. Answer the user's question directly and concisely."
  }
  const toolSchemas = tools
    .map((t) =>
      JSON.stringify({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters }
      })
    )
    .join("\n")
  return `You are a function calling AI model. You are provided with function signatures within <tools></tools> XML tags. You may call one or more functions to assist with the user query. Don't make assumptions about what values to plug into functions. Here are the available tools:
<tools>
${toolSchemas}
</tools>
Use the following pydantic model json schema for each tool call you will make:
{"properties": {"arguments": {"title": "Arguments", "type": "object"}, "name": {"title": "Name", "type": "string"}}, "required": ["arguments", "name"], "title": "FunctionCall", "type": "object"}
For each function call return a json object with function name and arguments within <tool_call></tool_call> XML tags as follows:
<tool_call>
{"arguments": <args-dict>, "name": <function-name>}
</tool_call>`
}

function parseToolCalls(
  response: string
): Array<{ name: string; arguments: Record<string, unknown> }> {
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = []
  const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as { name: string; arguments: Record<string, unknown> }
      if (parsed.name && typeof parsed.name === "string") {
        calls.push({ name: parsed.name, arguments: parsed.arguments ?? {} })
      }
    } catch {
      debug("[Manager] Failed to parse tool call JSON:", match[1])
    }
  }
  return calls
}

type StatusUpdater = (status: WebLLMStatus) => void
type ToolRequester = (
  invokeId: string,
  toolCallId: string,
  name: string,
  args: Record<string, unknown>
) => Promise<WebLLMToolResult>

let engine: MLCEngineInterface | null = null
let engineReady = false
let engineBusy = false
let activeInvokeAbort: AbortController | null = null

function broadcastStatus(onStatus: StatusUpdater, status: WebLLMStatus): void {
  onStatus(status)
  window.api.webllm.reportStatus(status)
}

export async function startWebLLMManager(
  onStatus: StatusUpdater,
  requestTool: ToolRequester
): Promise<void> {
  debug("[Manager] Starting WebLLM manager")

  if (!navigator.gpu) {
    broadcastStatus(onStatus, {
      phase: "unsupported",
      progress: 0,
      statusText: "WebGPU not supported in this browser"
    })
    return
  }

  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      broadcastStatus(onStatus, {
        phase: "unsupported",
        progress: 0,
        statusText: "No WebGPU adapter available"
      })
      return
    }
  } catch {
    broadcastStatus(onStatus, {
      phase: "unsupported",
      progress: 0,
      statusText: "WebGPU adapter request failed"
    })
    return
  }

  broadcastStatus(onStatus, {
    phase: "downloading",
    progress: 0,
    statusText: "Initializing model download..."
  })

  const initProgressCallback = (report: InitProgressReport): void => {
    debug("[Manager] Progress:", report.text, report.progress)
    const pct = Math.round((report.progress ?? 0) * 100)
    const isLoading =
      report.text.toLowerCase().includes("load") && !report.text.toLowerCase().includes("fetch")
    broadcastStatus(onStatus, {
      phase: isLoading ? "loading" : "downloading",
      progress: pct,
      statusText: report.text
    })
  }

  try {
    const worker = new Worker(new URL("../workers/webllm.worker.ts", import.meta.url), {
      type: "module"
    })

    engine = await CreateWebWorkerMLCEngine(worker, WEBLLM_MODEL_ID, {
      initProgressCallback
    })

    engineReady = true
    broadcastStatus(onStatus, { phase: "ready", progress: 100, statusText: "Hermes ready" })
    debug("[Manager] WebLLM engine ready")

    window.api.webllm.onInvoke(async (payload: WebLLMInvokePayload) => {
      await handleInvoke(payload, onStatus, requestTool)
    })

    window.api.webllm.onCancel((invokeId: string) => {
      debug("[Manager] Cancel requested for invokeId:", invokeId)
      activeInvokeAbort?.abort()
    })

    window.api.webllm.reportReady()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    debug("[Manager] Engine initialization failed:", msg)
    broadcastStatus(onStatus, {
      phase: "error",
      progress: 0,
      statusText: "Model load failed",
      errorText: msg
    })
  }
}

async function handleInvoke(
  payload: WebLLMInvokePayload,
  onStatus: StatusUpdater,
  requestTool: ToolRequester
): Promise<void> {
  if (!engine || !engineReady) {
    window.api.webllm.sendInvokeResult({ invokeId: payload.invokeId, error: "Engine not ready" })
    return
  }

  if (engineBusy) {
    window.api.webllm.sendInvokeResult({
      invokeId: payload.invokeId,
      error: "Engine is busy with another request"
    })
    return
  }

  engineBusy = true
  const abortController = new AbortController()
  activeInvokeAbort = abortController
  broadcastStatus(onStatus, { phase: "busy", progress: 100, statusText: "Hermes processing..." })
  debug("[Manager] Handling invoke:", payload.invokeId, "task:", payload.task.substring(0, 60))

  try {
    const systemPrompt = buildHermesSystemPrompt(payload.allowedTools)
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: payload.task }
    ]

    let toolCallCounter = 0
    let finalResult = ""

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (abortController.signal.aborted) {
        window.api.webllm.sendInvokeResult({ invokeId: payload.invokeId, error: "Cancelled" })
        return
      }

      const reply = await engine.chat.completions.create({ stream: false, messages })
      const responseText = reply.choices[0]?.message?.content ?? ""
      messages.push({ role: "assistant", content: responseText })

      const toolCalls = parseToolCalls(responseText)
      if (toolCalls.length === 0) {
        finalResult = responseText
        break
      }

      for (const call of toolCalls) {
        const toolCallId = String(toolCallCounter++)
        debug("[Manager] Tool call:", call.name, "args:", call.arguments)

        const toolResult = await requestTool(
          payload.invokeId,
          toolCallId,
          call.name,
          call.arguments
        )

        const toolResponse = toolResult.error
          ? `<tool_response>\n{"name": "${call.name}", "content": "Error: ${toolResult.error}"}\n</tool_response>`
          : `<tool_response>\n{"name": "${call.name}", "content": ${JSON.stringify(toolResult.result)}}\n</tool_response>`

        messages.push({ role: "tool", content: toolResponse, tool_call_id: toolCallId })
      }
    }

    window.api.webllm.sendInvokeResult({ invokeId: payload.invokeId, result: finalResult })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    debug("[Manager] Invoke failed:", msg)
    window.api.webllm.sendInvokeResult({ invokeId: payload.invokeId, error: msg })
  } finally {
    activeInvokeAbort = null
    engineBusy = false
    broadcastStatus(onStatus, { phase: "ready", progress: 100, statusText: "Hermes ready" })
  }
}
