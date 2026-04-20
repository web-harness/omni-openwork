import type { IpcMain } from "electron"
import { registerAgentHandlers } from "./agent"
import { registerAgentEndpointHandlers } from "./agent-endpoints"
import { registerThreadHandlers } from "./threads"
import { registerModelHandlers } from "./models"
import { registerSettingsHandlers } from "./settings"
import { registerWebLLMHandlers } from "../webllm/ipc"

export function registerAllHandlers(ipcMain: IpcMain): void {
  registerAgentHandlers(ipcMain)
  registerAgentEndpointHandlers(ipcMain)
  registerThreadHandlers(ipcMain)
  registerModelHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerWebLLMHandlers(ipcMain)
}
