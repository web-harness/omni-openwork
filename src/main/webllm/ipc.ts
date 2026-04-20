/**
 * WebLLM IPC handlers.
 *
 * Channels:
 *   webllm:ready        renderer → main  (worker is loaded & engine ready)
 *   webllm:status       renderer → main  (progress updates)
 *   webllm:invoke-result renderer → main (function-calling loop completed)
 *   webllm:tool-request  renderer → main (Hermes wants to call a host tool)
 *   webllm:invoke       main → renderer  (sent by broker, not registered here)
 *   webllm:tool-result:* main → renderer (sent by broker, not registered here)
 */

import type { IpcMain, BrowserWindow } from "electron"
import createDebug from "debug"
import {
  onWindowReady,
  onWindowStatus,
  onInvokeResult,
  registerWindow,
  getInvokeWorkspacePath,
  clearInvokeWorkspacePath
} from "./broker"
import { executeTool } from "./tool-registry"
import type {
  WebLLMStatus,
  WebLLMInvokeResult,
  WebLLMToolRequest,
  WebLLMToolResult
} from "../../types"

const debug = createDebug("omni:webllm:ipc")

export function registerWebLLMHandlers(ipcMain: IpcMain): void {
  debug("[WebLLM IPC] Registering handlers")

  // Renderer reports the engine is ready (model fully loaded into GPU)
  ipcMain.on("webllm:ready", (event) => {
    debug("[WebLLM IPC] Engine ready from webContents:", event.sender.id)
    onWindowReady(event.sender.id)
  })

  // Renderer sends status updates (progress, phase, text)
  ipcMain.on("webllm:status", (event, status: WebLLMStatus) => {
    debug("[WebLLM IPC] Status update:", status.phase, status.progress)
    onWindowStatus(event.sender.id, status)
  })

  // Renderer sends invoke result (the final answer from Hermes)
  ipcMain.on("webllm:invoke-result", (event, result: WebLLMInvokeResult) => {
    debug("[WebLLM IPC] Invoke result received:", result.invokeId)
    clearInvokeWorkspacePath(result.invokeId)
    onInvokeResult(event.sender.id, result)
  })

  // Renderer sends a tool call request (Hermes wants to call a host tool)
  ipcMain.on("webllm:tool-request", async (event, req: WebLLMToolRequest) => {
    debug("[WebLLM IPC] Tool request:", req.name, "invokeId:", req.invokeId)
    const workspacePath = getInvokeWorkspacePath(req.invokeId)

    let toolResult: WebLLMToolResult
    try {
      const result = await executeTool(req.name, req.arguments, workspacePath)
      toolResult = { invokeId: req.invokeId, toolCallId: req.toolCallId, result }
    } catch (e) {
      toolResult = {
        invokeId: req.invokeId,
        toolCallId: req.toolCallId,
        result: "",
        error: e instanceof Error ? e.message : String(e)
      }
    }

    event.sender.send(`webllm:tool-result:${req.invokeId}:${req.toolCallId}`, toolResult)
    debug("[WebLLM IPC] Tool result sent for:", req.name)
  })
}

// Register the window when it's created so the broker can send to it
export function registerBrowserWindow(window: BrowserWindow): void {
  registerWindow(window.webContents)
}
