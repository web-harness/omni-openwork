import type {
  Thread,
  ModelConfig,
  Provider,
  StreamEvent,
  HITLDecision,
  RemoteAgentConfig
} from "../main/types"
import type { AgentEndpoint } from "../renderer/src/types"
import type {
  WebLLMStatus,
  WebLLMInvokePayload,
  WebLLMInvokeResult,
  WebLLMToolResult
} from "../types"

interface ElectronAPI {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => void
    on: (channel: string, listener: (...args: unknown[]) => void) => () => void
    once: (channel: string, listener: (...args: unknown[]) => void) => void
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  }
  process: {
    platform: NodeJS.Platform
    versions: NodeJS.ProcessVersions
  }
}

interface CustomAPI {
  agent: {
    invoke: (
      threadId: string,
      message: string,
      onEvent: (event: StreamEvent) => void,
      modelId?: string
    ) => () => void
    streamAgent: (
      threadId: string,
      message: string,
      command: unknown,
      onEvent: (event: StreamEvent) => void,
      modelId?: string,
      agentEndpoints?: RemoteAgentConfig[]
    ) => () => void
    interrupt: (
      threadId: string,
      decision: HITLDecision,
      onEvent?: (event: StreamEvent) => void
    ) => () => void
    cancel: (threadId: string) => Promise<void>
    streamRemote: (
      threadId: string,
      message: string,
      endpointUrl: string,
      graphId: string,
      apiKey: string | undefined,
      onEvent: (event: StreamEvent) => void
    ) => () => void
  }
  threads: {
    list: () => Promise<Thread[]>
    get: (threadId: string) => Promise<Thread | null>
    create: (metadata?: Record<string, unknown>) => Promise<Thread>
    update: (threadId: string, updates: Partial<Thread>) => Promise<Thread>
    delete: (threadId: string) => Promise<void>
    getHistory: (threadId: string) => Promise<unknown[]>
    generateTitle: (message: string) => Promise<string>
  }
  models: {
    list: () => Promise<ModelConfig[]>
    listProviders: () => Promise<Provider[]>
    getDefault: () => Promise<string>
    setDefault: (modelId: string) => Promise<void>
    setApiKey: (provider: string, apiKey: string) => Promise<void>
    getApiKey: (provider: string) => Promise<string | null>
    deleteApiKey: (provider: string) => Promise<void>
    setBaseUrl: (provider: string, baseUrl: string) => Promise<void>
    getBaseUrl: (provider: string) => Promise<string | null>
    deleteBaseUrl: (provider: string) => Promise<void>
  }
  workspace: {
    get: (threadId?: string) => Promise<string | null>
    set: (threadId: string | undefined, path: string | null) => Promise<string | null>
    select: (threadId?: string) => Promise<string | null>
    loadFromDisk: (threadId: string) => Promise<{
      success: boolean
      files: Array<{
        path: string
        is_dir: boolean
        size?: number
        modified_at?: string
      }>
      workspacePath?: string
      error?: string
    }>
    readFile: (
      threadId: string,
      filePath: string
    ) => Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }>
    readBinaryFile: (
      threadId: string,
      filePath: string
    ) => Promise<{
      success: boolean
      content?: string
      size?: number
      modified_at?: string
      error?: string
    }>
    onFilesChanged: (
      callback: (data: { threadId: string; workspacePath: string }) => void
    ) => () => void
  }
  settings: {
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string) => Promise<void>
  }
  agentEndpoints: {
    list: () => Promise<AgentEndpoint[]>
    upsert: (endpoint: AgentEndpoint) => Promise<AgentEndpoint>
    delete: (id: string) => Promise<void>
  }
  webllm: {
    reportReady: () => void
    reportStatus: (status: WebLLMStatus) => void
    requestTool: (
      invokeId: string,
      toolCallId: string,
      name: string,
      args: Record<string, unknown>
    ) => Promise<WebLLMToolResult>
    sendInvokeResult: (result: WebLLMInvokeResult) => void
    onInvoke: (callback: (payload: WebLLMInvokePayload) => void) => () => void
    onCancel: (callback: (invokeId: string) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
