/**
 * WebLLM Broker: main-process bridge between the lesser agent Runnable and
 * the renderer-side WebLLM worker manager.
 *
 * Keyed by WebContents ID so each renderer window has its own state.
 */

import createDebug from "debug"
import type { WebContents } from "electron"
import type { WebLLMInvokePayload, WebLLMInvokeResult, WebLLMStatus } from "../../types"

const debug = createDebug("omni:webllm:broker")

interface WindowState {
  webContents: WebContents
  ready: boolean
  status: WebLLMStatus
  // Resolvers for in-flight invoke: invokeId → { resolve, reject }
  invokeResolvers: Map<string, { resolve: (result: string) => void; reject: (err: Error) => void }>
}

const windows = new Map<number, WindowState>()

export function registerWindow(webContents: WebContents): void {
  const id = webContents.id
  windows.set(id, {
    webContents,
    ready: false,
    status: { phase: "idle", progress: 0, statusText: "Initializing" },
    invokeResolvers: new Map()
  })
  debug("[Broker] Registered window:", id)

  webContents.on("destroyed", () => {
    const state = windows.get(id)
    if (state) {
      // Reject all pending resolvers
      for (const [, res] of state.invokeResolvers) {
        res.reject(new Error("Window closed"))
      }
    }
    windows.delete(id)
    debug("[Broker] Window destroyed, unregistered:", id)
  })
}

export function onWindowReady(webContentsId: number): void {
  const state = windows.get(webContentsId)
  if (state) {
    state.ready = true
    debug("[Broker] Window marked ready:", webContentsId)
  }
}

export function onWindowStatus(webContentsId: number, status: WebLLMStatus): void {
  const state = windows.get(webContentsId)
  if (state) {
    state.status = status
    state.ready = status.phase === "ready"
  }
}

export function isReady(webContentsId: number): boolean {
  return windows.get(webContentsId)?.ready ?? false
}

// Workspace path per active invoke, keyed by invokeId.
// Populated by invokeLesserAgent; consumed by the tool-request IPC handler.
const invokeWorkspacePaths = new Map<string, string>()

export function setInvokeWorkspacePath(invokeId: string, workspacePath: string): void {
  invokeWorkspacePaths.set(invokeId, workspacePath)
}

export function getInvokeWorkspacePath(invokeId: string): string {
  return invokeWorkspacePaths.get(invokeId) ?? ""
}

export function clearInvokeWorkspacePath(invokeId: string): void {
  invokeWorkspacePaths.delete(invokeId)
}

export function invokeLesserAgent(
  webContentsId: number,
  payload: Omit<WebLLMInvokePayload, "invokeId">,
  invokeId: string
): Promise<string> {
  const state = windows.get(webContentsId)
  if (!state) throw new Error("No WebLLM window registered for id: " + webContentsId)
  if (!state.ready) throw new Error("WebLLM engine not ready")

  setInvokeWorkspacePath(invokeId, payload.workspacePath)

  return new Promise<string>((resolve, reject) => {
    state.invokeResolvers.set(invokeId, { resolve, reject })
    const fullPayload: WebLLMInvokePayload = { ...payload, invokeId }
    state.webContents.send("webllm:invoke", fullPayload)
    debug("[Broker] Sent invoke to renderer:", invokeId)
  })
}

export function onInvokeResult(webContentsId: number, result: WebLLMInvokeResult): void {
  const state = windows.get(webContentsId)
  if (!state) return
  const resolver = state.invokeResolvers.get(result.invokeId)
  if (!resolver) {
    debug("[Broker] No resolver for invokeId:", result.invokeId)
    return
  }
  state.invokeResolvers.delete(result.invokeId)

  if (result.error) {
    resolver.reject(new Error(result.error))
  } else {
    resolver.resolve(result.result ?? "")
  }
}
