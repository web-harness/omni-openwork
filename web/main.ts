import createDebug from "debug"

const debug = createDebug("omni:web")

import { waitForInitialization } from "./initialize"
import { app, ipcMain } from "./shims/electron"

async function main(): Promise<void> {
  await waitForInitialization()

  const { initializeDatabase } = await import("../src/main/db")
  await initializeDatabase()

  const { registerAllHandlers } = await import("../src/main/ipc")

  registerAllHandlers(ipcMain)

  app.markReady()

  await import("../src/preload/index")
  await import("../src/renderer/src/main")
}

main().catch((err) => {
  debug("[web/main] Startup failed:", err)
})
