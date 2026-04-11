import { waitForInitialization } from "./initialize"
import { app, ipcMain } from "./shims/electron"

async function main(): Promise<void> {
  await waitForInitialization()

  const { initializeDatabase } = await import("../src/main/db")
  await initializeDatabase()

  const { registerAgentHandlers } = await import("../src/main/ipc/agent")
  const { registerAgentEndpointHandlers } = await import("../src/main/ipc/agent-endpoints")
  const { registerThreadHandlers } = await import("../src/main/ipc/threads")
  const { registerModelHandlers } = await import("../src/main/ipc/models")

  registerAgentHandlers(ipcMain)
  registerAgentEndpointHandlers(ipcMain)
  registerThreadHandlers(ipcMain)
  registerModelHandlers(ipcMain)

  app.markReady()

  await import("../src/preload/index")
  await import("../src/renderer/src/main")
}

main().catch((err) => {
  console.error("[web/main] Startup failed:", err)
})
