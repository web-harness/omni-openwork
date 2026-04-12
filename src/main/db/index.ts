import initSqlJs, { Database as SqlJsDatabase } from "sql.js"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { dirname } from "path"
import { getDbPath } from "../storage"

let db: SqlJsDatabase | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let dirty = false

/**
 * Save database to disk (debounced)
 */
function saveToDisk(): void {
  if (!db) return

  dirty = true

  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    if (db && dirty) {
      const data = db.export()
      writeFileSync(getDbPath(), Buffer.from(data))
      dirty = false
    }
  }, 100)
}

/**
 * Force immediate save
 */
export async function flush(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (db && dirty) {
    const data = db.export()
    writeFileSync(getDbPath(), Buffer.from(data))
    dirty = false
  }
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.")
  }
  return db
}

export async function initializeDatabase(): Promise<SqlJsDatabase> {
  const dbPath = getDbPath()
  console.log("Initializing database at:", dbPath)

  const SQL = await initSqlJs()

  // Load existing database if it exists
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    // Ensure directory exists
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    db = new SQL.Database()
  }

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS threads (
      thread_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT,
      status TEXT DEFAULT 'idle',
      thread_values TEXT,
      title TEXT,
      agent_id TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      thread_id TEXT REFERENCES threads(thread_id) ON DELETE CASCADE,
      assistant_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT,
      metadata TEXT,
      kwargs TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS assistants (
      assistant_id TEXT PRIMARY KEY,
      graph_id TEXT NOT NULL,
      name TEXT,
      model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
      config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs(thread_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)`)

  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS agent_endpoints (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL DEFAULT '',
      bearer_token TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      removable INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  saveToDisk()

  console.log("Database initialized successfully")
  return db
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (db) {
    // Save any pending changes
    if (dirty) {
      const data = db.export()
      writeFileSync(getDbPath(), Buffer.from(data))
    }
    db.close()
    db = null
  }
}

// Helper functions for common operations

/** Raw thread row from SQLite database (timestamps as numbers, metadata as JSON string) */
export interface ThreadRow {
  thread_id: string
  created_at: number
  updated_at: number
  metadata: string | null
  status: string
  thread_values: string | null
  title: string | null
  agent_id: string | null
}

export function getAllThreads(): ThreadRow[] {
  const database = getDb()
  const stmt = database.prepare("SELECT * FROM threads ORDER BY updated_at DESC")
  const threads: ThreadRow[] = []

  while (stmt.step()) {
    threads.push(stmt.getAsObject() as unknown as ThreadRow)
  }
  stmt.free()

  return threads
}

export function getThread(threadId: string): ThreadRow | null {
  const database = getDb()
  const stmt = database.prepare("SELECT * FROM threads WHERE thread_id = ?")
  stmt.bind([threadId])

  if (!stmt.step()) {
    stmt.free()
    return null
  }

  const thread = stmt.getAsObject() as unknown as ThreadRow
  stmt.free()
  return thread
}

export function createThread(
  threadId: string,
  metadata?: Record<string, unknown>,
  agentId?: string | null
): ThreadRow {
  const database = getDb()
  const now = Date.now()

  const title = (metadata?.title as string) ?? null
  const cleanMetadata = metadata ? { ...metadata } : undefined
  if (cleanMetadata) delete cleanMetadata.title
  const metadataStr =
    cleanMetadata && Object.keys(cleanMetadata).length > 0 ? JSON.stringify(cleanMetadata) : null

  database.run(
    `INSERT INTO threads (thread_id, created_at, updated_at, metadata, status, agent_id, title)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [threadId, now, now, metadataStr, "idle", agentId ?? null, title]
  )

  saveToDisk()

  return {
    thread_id: threadId,
    created_at: now,
    updated_at: now,
    metadata: metadataStr,
    status: "idle",
    thread_values: null,
    title,
    agent_id: agentId ?? null
  }
}

export function updateThread(
  threadId: string,
  updates: Partial<Omit<ThreadRow, "thread_id" | "created_at">>
): ThreadRow | null {
  const database = getDb()
  const existing = getThread(threadId)

  if (!existing) return null

  const now = Date.now()
  const setClauses: string[] = ["updated_at = ?"]
  const values: (string | number | null)[] = [now]

  if (updates.metadata !== undefined) {
    setClauses.push("metadata = ?")
    values.push(
      typeof updates.metadata === "string" ? updates.metadata : JSON.stringify(updates.metadata)
    )
  }
  if (updates.status !== undefined) {
    setClauses.push("status = ?")
    values.push(updates.status)
  }
  if (updates.thread_values !== undefined) {
    setClauses.push("thread_values = ?")
    values.push(updates.thread_values)
  }
  if (updates.title !== undefined) {
    setClauses.push("title = ?")
    values.push(updates.title)
  }
  if (updates.agent_id !== undefined) {
    setClauses.push("agent_id = ?")
    values.push(updates.agent_id)
  }

  values.push(threadId)

  database.run(`UPDATE threads SET ${setClauses.join(", ")} WHERE thread_id = ?`, values)

  saveToDisk()

  return getThread(threadId)
}

export function deleteThread(threadId: string): void {
  const database = getDb()
  database.run("DELETE FROM threads WHERE thread_id = ?", [threadId])
  saveToDisk()
}

export interface AgentEndpointRow {
  id: string
  url: string
  bearer_token: string
  name: string
  /** SQLite boolean: 0 = built-in, 1 = user-added */
  removable: number
  created_at: number
  updated_at: number
}

export function getAllAgentEndpoints(): AgentEndpointRow[] {
  const database = getDb()
  const stmt = database.prepare("SELECT * FROM agent_endpoints ORDER BY created_at ASC")
  const rows: AgentEndpointRow[] = []

  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as AgentEndpointRow)
  }
  stmt.free()

  return rows
}

export function upsertAgentEndpoint(
  id: string,
  data: { url: string; bearerToken: string; name: string; removable: boolean }
): AgentEndpointRow {
  const database = getDb()
  const now = Date.now()

  const stmt = database.prepare("SELECT id FROM agent_endpoints WHERE id = ?")
  stmt.bind([id])
  const exists = stmt.step()
  stmt.free()

  if (exists) {
    database.run(
      `UPDATE agent_endpoints SET url = ?, bearer_token = ?, name = ?, removable = ?, updated_at = ? WHERE id = ?`,
      [data.url, data.bearerToken, data.name, data.removable ? 1 : 0, now, id]
    )
  } else {
    database.run(
      `INSERT INTO agent_endpoints (id, url, bearer_token, name, removable, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.url, data.bearerToken, data.name, data.removable ? 1 : 0, now, now]
    )
  }

  saveToDisk()

  return {
    id,
    url: data.url,
    bearer_token: data.bearerToken,
    name: data.name,
    removable: data.removable ? 1 : 0,
    created_at: now,
    updated_at: now
  }
}

export function deleteAgentEndpoint(id: string): void {
  const database = getDb()
  database.run("DELETE FROM agent_endpoints WHERE id = ?", [id])
  saveToDisk()
}

export function getSetting(key: string): string | null {
  const database = getDb()
  const stmt = database.prepare("SELECT value FROM settings WHERE key = ?")
  stmt.bind([key])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject() as { value: string | null }
  stmt.free()
  return row.value
}

export function setSetting(key: string, value: string): void {
  const database = getDb()
  database.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value])
  saveToDisk()
}
