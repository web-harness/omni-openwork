import createDebug from "debug"

const debug = createDebug("omni:web:init")

import { configure } from "@zenfs/core"
import { IndexedDB } from "@zenfs/dom"

let initialized = false

async function init(): Promise<void> {
  if (initialized) return

  await configure({
    mounts: { "/": { backend: IndexedDB, storeName: "openwork-fs" } }
  })

  initialized = true
}

const initPromise = init().catch((err) => {
  debug("[ZenFS] Initialization failed:", err)
})

export function isInitialized(): boolean {
  return initialized
}

export async function waitForInitialization(): Promise<void> {
  await initPromise
}
