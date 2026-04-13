import createDebug from "debug"

const debug = createDebug("omni:store")

import { create } from "zustand"
import type { Thread, ModelConfig, Provider, AgentEndpoint } from "@/types"

function buildMainAgent(): AgentEndpoint {
  return {
    id: "main",
    url: "",
    bearerToken: "",
    name: "Main Agent",
    removable: false
  }
}

interface AppState {
  // Threads
  threads: Thread[]
  currentThreadId: string | null

  // Models and Providers (global, not per-thread)
  models: ModelConfig[]
  providers: Provider[]

  // Right panel state (UI state, not thread data)
  rightPanelTab: "todos" | "files" | "subagents"

  // Settings dialog state
  settingsOpen: boolean

  // Sidebar state
  sidebarCollapsed: boolean

  // Kanban view state
  showKanbanView: boolean
  showSubagentsInKanban: boolean

  // Agent endpoints
  agentEndpoints: AgentEndpoint[]
  activeAgentId: string | null
  dicebearStyle: string

  // Theme
  theme: "dark" | "light"
  loadTheme: () => Promise<void>
  setTheme: (theme: "dark" | "light") => Promise<void>

  // Thread actions
  loadThreads: () => Promise<void>
  createThread: (metadata?: Record<string, unknown>) => Promise<Thread>
  selectThread: (threadId: string) => Promise<void>
  deleteThread: (threadId: string) => Promise<void>
  updateThread: (threadId: string, updates: Partial<Thread>) => Promise<void>
  generateTitleForFirstMessage: (threadId: string, content: string) => Promise<void>

  // Model actions
  loadModels: () => Promise<void>
  loadProviders: () => Promise<void>
  setApiKey: (providerId: string, apiKey: string) => Promise<void>
  deleteApiKey: (providerId: string) => Promise<void>
  setBaseUrl: (providerId: string, baseUrl: string) => Promise<void>
  deleteBaseUrl: (providerId: string) => Promise<void>

  // Panel actions
  setRightPanelTab: (tab: "todos" | "files" | "subagents") => void

  // Settings actions
  setSettingsOpen: (open: boolean) => void

  // Sidebar actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  // Kanban actions
  setShowKanbanView: (show: boolean) => void
  setShowSubagentsInKanban: (show: boolean) => void

  // Agent endpoint actions
  upsertAgentEndpoint: (endpoint: AgentEndpoint) => Promise<void>
  removeAgentEndpoint: (id: string) => Promise<void>
  setActiveAgentId: (id: string | null) => Promise<void>
  loadAgentEndpoints: () => Promise<void>
  orderedAgentEndpoints: () => AgentEndpoint[]
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  threads: [],
  currentThreadId: null,
  models: [],
  providers: [],
  rightPanelTab: "todos",
  settingsOpen: false,
  sidebarCollapsed: false,
  showKanbanView: false,
  showSubagentsInKanban: true,
  agentEndpoints: [buildMainAgent()],
  activeAgentId: null,
  dicebearStyle: "bottts-neutral",
  theme: "dark",

  // Thread actions
  loadThreads: async () => {
    const threads = await window.api.threads.list()
    set({ threads })

    if (!get().currentThreadId && threads.length > 0) {
      const activeAgentId = get().activeAgentId
      const agentThreads = threads.filter((t) => (t.agent_id ?? null) === activeAgentId)
      const firstThread = agentThreads[0] ?? threads[0]
      await get().selectThread(firstThread.thread_id)
    }
  },

  createThread: async (metadata?: Record<string, unknown>) => {
    const activeAgentId = get().activeAgentId
    const thread = await window.api.threads.create({
      ...metadata,
      agent_id: activeAgentId ?? null
    })
    set((state) => ({
      threads: [thread, ...state.threads],
      currentThreadId: thread.thread_id,
      showKanbanView: false
    }))
    return thread
  },

  selectThread: async (threadId: string) => {
    // Just update currentThreadId - ThreadContext handles per-thread state
    // Also close kanban view when selecting a thread
    set({ currentThreadId: threadId, showKanbanView: false })
  },

  deleteThread: async (threadId: string) => {
    debug("[Store] Deleting thread:", threadId)
    try {
      await window.api.threads.delete(threadId)
      debug("[Store] Thread deleted from backend")

      set((state) => {
        const threads = state.threads.filter((t) => t.thread_id !== threadId)
        const wasCurrentThread = state.currentThreadId === threadId
        const newCurrentId = wasCurrentThread
          ? threads[0]?.thread_id || null
          : state.currentThreadId

        return {
          threads,
          currentThreadId: newCurrentId
        }
      })
    } catch (error) {
      debug("[Store] Failed to delete thread:", error)
    }
  },

  updateThread: async (threadId: string, updates: Partial<Thread>) => {
    const updated = await window.api.threads.update(threadId, updates)
    set((state) => ({
      threads: state.threads.map((t) => (t.thread_id === threadId ? updated : t))
    }))
  },

  generateTitleForFirstMessage: async (threadId: string, content: string) => {
    try {
      const generatedTitle = await window.api.threads.generateTitle(content)
      await get().updateThread(threadId, { title: generatedTitle })
    } catch (error) {
      debug("[Store] Failed to generate title:", error)
    }
  },

  // Model actions
  loadModels: async () => {
    const models = await window.api.models.list()
    set({ models })
  },

  loadProviders: async () => {
    const providers = await window.api.models.listProviders()
    set({ providers })
  },

  setApiKey: async (providerId: string, apiKey: string) => {
    debug("[Store] setApiKey called:", { providerId, keyLength: apiKey.length })
    try {
      await window.api.models.setApiKey(providerId, apiKey)
      debug("[Store] API key saved via IPC")
      // Reload providers and models to update availability
      await get().loadProviders()
      await get().loadModels()
      debug("[Store] Providers and models reloaded")
    } catch (e) {
      debug("[Store] Failed to set API key:", e)
      throw e
    }
  },

  deleteApiKey: async (providerId: string) => {
    await window.api.models.deleteApiKey(providerId)
    // Reload providers and models to update availability
    await get().loadProviders()
    await get().loadModels()
  },

  setBaseUrl: async (providerId: string, baseUrl: string) => {
    await window.api.models.setBaseUrl(providerId, baseUrl)
    await get().loadProviders()
  },

  deleteBaseUrl: async (providerId: string) => {
    await window.api.models.deleteBaseUrl(providerId)
    await get().loadProviders()
  },

  // Panel actions
  setRightPanelTab: (tab: "todos" | "files" | "subagents") => {
    set({ rightPanelTab: tab })
  },

  // Settings actions
  setSettingsOpen: (open: boolean) => {
    set({ settingsOpen: open })
  },

  // Sidebar actions
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed })
  },

  // Kanban actions
  setShowKanbanView: (show: boolean) => {
    if (show) {
      set({ showKanbanView: true, currentThreadId: null })
    } else {
      set({ showKanbanView: false })
    }
  },

  setShowSubagentsInKanban: (show: boolean) => {
    set({ showSubagentsInKanban: show })
  },

  upsertAgentEndpoint: async (endpoint: AgentEndpoint) => {
    await window.api.agentEndpoints.upsert(endpoint)
    set((state) => {
      const existing = state.agentEndpoints.findIndex((e) => e.id === endpoint.id)
      if (existing >= 0) {
        const updated = [...state.agentEndpoints]
        updated[existing] = endpoint
        return { agentEndpoints: updated }
      }
      return { agentEndpoints: [...state.agentEndpoints, endpoint] }
    })
  },

  removeAgentEndpoint: async (id: string) => {
    await window.api.agentEndpoints.delete(id)
    set((state) => ({
      agentEndpoints: state.agentEndpoints.filter((e) => e.id !== id || !e.removable),
      activeAgentId: state.activeAgentId === id ? null : state.activeAgentId
    }))
  },

  setActiveAgentId: async (id: string | null) => {
    set({ activeAgentId: id, showKanbanView: false })
    const threads = get().threads
    const agentThreads = threads.filter((t) => (t.agent_id ?? null) === id)
    if (agentThreads.length > 0) {
      set({ currentThreadId: agentThreads[0].thread_id })
    } else {
      await get().createThread()
    }
  },

  loadAgentEndpoints: async () => {
    const persisted = await window.api.agentEndpoints.list()
    const main = buildMainAgent()
    const userAgents = persisted.filter((e) => e.removable)
    set({ agentEndpoints: [main, ...userAgents] })
  },

  orderedAgentEndpoints: () => {
    const { agentEndpoints } = get()
    const fixed = agentEndpoints.filter((e) => !e.removable)
    const removable = agentEndpoints.filter((e) => e.removable)
    return [...fixed, ...removable]
  },

  loadTheme: async () => {
    const value = await window.api.settings.get("theme")
    const theme = value === "light" ? "light" : "dark"
    set({ theme })
    document.documentElement.setAttribute("data-theme", theme)
  },

  setTheme: async (theme: "dark" | "light") => {
    set({ theme })
    document.documentElement.setAttribute("data-theme", theme)
    await window.api.settings.set("theme", theme)
  }
}))
