import { IpcMain } from "electron"
import { v4 as uuid } from "uuid"
import {
  getAllThreads,
  getThread,
  createThread as dbCreateThread,
  updateThread as dbUpdateThread,
  deleteThread as dbDeleteThread
} from "../db"
import { getCheckpointer, closeCheckpointer } from "../agent/runtime"
import { deleteThreadCheckpoint } from "../storage"
import { generateTitle } from "../services/title-generator"
import createDebug from "debug"

const debug = createDebug("omni:threads")
import type { Thread, ThreadUpdateParams } from "../types"

export function registerThreadHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("threads:list", async () => {
    let threads = getAllThreads()
    if (threads.length === 0) {
      const threadId = uuid()
      dbCreateThread(threadId)
      threads = getAllThreads()
    }
    return threads.map((row) => ({
      thread_id: row.thread_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      status: row.status as Thread["status"],
      thread_values: row.thread_values ? JSON.parse(row.thread_values) : undefined,
      title: row.title,
      agent_id: row.agent_id ?? null
    }))
  })

  // Get a single thread
  ipcMain.handle("threads:get", async (_event, threadId: string) => {
    const row = getThread(threadId)
    if (!row) return null
    return {
      thread_id: row.thread_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      status: row.status as Thread["status"],
      thread_values: row.thread_values ? JSON.parse(row.thread_values) : undefined,
      title: row.title,
      agent_id: row.agent_id ?? null
    }
  })

  // Create a new thread
  ipcMain.handle("threads:create", async (_event, metadata?: Record<string, unknown>) => {
    const threadId = uuid()
    const title = (metadata?.title as string) || null
    const agentId = (metadata?.agent_id as string | null | undefined) ?? null

    const cleanMetadata = { ...metadata }
    delete cleanMetadata.agent_id

    const thread = dbCreateThread(
      threadId,
      { ...cleanMetadata, ...(title ? { title } : {}) },
      agentId
    )

    return {
      thread_id: thread.thread_id,
      created_at: new Date(thread.created_at),
      updated_at: new Date(thread.updated_at),
      metadata: thread.metadata ? JSON.parse(thread.metadata) : undefined,
      status: thread.status as Thread["status"],
      thread_values: thread.thread_values ? JSON.parse(thread.thread_values) : undefined,
      title: thread.title ?? null,
      agent_id: thread.agent_id ?? null
    } as Thread
  })

  // Update a thread
  ipcMain.handle("threads:update", async (_event, { threadId, updates }: ThreadUpdateParams) => {
    const updateData: Parameters<typeof dbUpdateThread>[1] = {}

    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.metadata !== undefined) updateData.metadata = JSON.stringify(updates.metadata)
    if (updates.thread_values !== undefined)
      updateData.thread_values = JSON.stringify(updates.thread_values)
    if (updates.agent_id !== undefined) updateData.agent_id = updates.agent_id ?? null

    const row = dbUpdateThread(threadId, updateData)
    if (!row) throw new Error("Thread not found")

    return {
      thread_id: row.thread_id,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      status: row.status as Thread["status"],
      thread_values: row.thread_values ? JSON.parse(row.thread_values) : undefined,
      title: row.title,
      agent_id: row.agent_id ?? null
    }
  })

  // Delete a thread
  ipcMain.handle("threads:delete", async (_event, threadId: string) => {
    debug("[Threads] Deleting thread:", threadId)

    // Delete from our metadata store
    dbDeleteThread(threadId)
    debug("[Threads] Deleted from metadata store")

    // Close any open checkpointer for this thread
    try {
      await closeCheckpointer(threadId)
      debug("[Threads] Closed checkpointer")
    } catch (e) {
      debug("[Threads] Failed to close checkpointer:", e)
    }

    // Delete the thread's checkpoint file
    try {
      deleteThreadCheckpoint(threadId)
      debug("[Threads] Deleted checkpoint file")
    } catch (e) {
      debug("[Threads] Failed to delete checkpoint file:", e)
    }
  })

  // Get thread history (checkpoints)
  ipcMain.handle("threads:history", async (_event, threadId: string) => {
    try {
      const checkpointer = await getCheckpointer(threadId)

      const history: unknown[] = []
      const config = { configurable: { thread_id: threadId } }

      for await (const checkpoint of checkpointer.list(config, { limit: 50 })) {
        history.push(checkpoint)
      }

      return history
    } catch (e) {
      debug("Failed to get thread history:", e)
      return []
    }
  })

  // Generate a title from a message
  ipcMain.handle("threads:generateTitle", async (_event, message: string) => {
    return generateTitle(message)
  })
}
