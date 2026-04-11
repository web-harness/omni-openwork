import { directoryOpen, fileOpen } from "browser-fs-access"
import EventEmitter from "eventemitter3"
import * as fs from "fs"

export default {}

interface OpenDialogOptions {
  properties?: Array<"openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles">
}

export const ipcRenderer = new (class extends EventEmitter {
  send(channel: string, ...args: unknown[]): void {
    ipcMain.emit(channel, {}, ...args)
  }

  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return ipcMain.emitAsync(channel, ...args)
  }

  removeListener(channel: string, listener: (...args: unknown[]) => void): this {
    this.off(channel, listener)
    return this
  }
})()

export const contextBridge = {
  exposeInMainWorld(key: string, api: unknown): void {
    if (typeof window !== "undefined") {
      ;(window as unknown as Record<string, unknown>)[key] = api
    }
    if (typeof globalThis !== "undefined") {
      ;(globalThis as unknown as Record<string, unknown>)[key] = api
    }
  }
}

const BrowserWindow = class extends EventEmitter {
  private static instance: InstanceType<typeof BrowserWindow>

  constructor() {
    super()
    BrowserWindow.instance = this
  }

  static getAllWindows(): InstanceType<typeof BrowserWindow>[] {
    return BrowserWindow.instance ? [BrowserWindow.instance] : []
  }

  static fromWebContents(_: unknown): InstanceType<typeof BrowserWindow> | null {
    return BrowserWindow.instance ?? null
  }

  webContents = new (class extends EventEmitter {
    setWindowOpenHandler(_: unknown): void {}

    send(channel: string, ...args: unknown[]): void {
      ipcRenderer.emit(channel, null, ...args)
    }
  })()

  loadFile(_path: string): void {}
}

export { BrowserWindow }

export const shell = {
  openExternal: async (url: string): Promise<void> => {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

export const nativeImage = {
  createFromPath: (_: string) => ({ isEmpty: () => true })
}

export const ipcMain = new (class extends EventEmitter {
  private handlers = new Map<string, (event: null, ...args: unknown[]) => Promise<unknown>>()

  handle(channel: string, listener: (event: null, ...args: unknown[]) => Promise<unknown>): void {
    this.handlers.set(channel, listener)
  }

  async emitAsync(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel)
    if (handler) return handler(null, ...args)
    return undefined
  }
})()

export const dialog = {
  showOpenDialog: async (
    options?: OpenDialogOptions
  ): Promise<{ canceled: boolean; filePaths: string[] }> => {
    try {
      const props = options?.properties ?? []

      if (props.includes("openDirectory")) {
        const files = await directoryOpen({ recursive: true })
        const list = Array.isArray(files) ? files : [files]

        if (list.length === 0) return { canceled: false, filePaths: ["/"] }

        const baseName = list[0].webkitRelativePath.split(/[/\\]/)[0]
        const basePath = `/${baseName}`

        for (const file of list) {
          const target = `/${file.webkitRelativePath.replace(/\\/g, "/")}`
          await writeFileToZen(file, target)
        }

        return { canceled: false, filePaths: [basePath] }
      } else {
        const multiple = props.includes("multiSelections")
        const files = await fileOpen({ multiple })
        const list = files == null ? [] : Array.isArray(files) ? files : [files]
        const paths: string[] = []

        for (const file of list) {
          const p = `/${file.name}`
          await writeFileToZen(file, p)
          paths.push(p)
        }

        return { canceled: false, filePaths: paths }
      }
    } catch {
      return { canceled: true, filePaths: [] }
    }
  }
}

async function writeFileToZen(file: File, target: string): Promise<void> {
  const buf = await file.arrayBuffer()
  const dir = target.substring(0, target.lastIndexOf("/"))
  if (dir) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(target, new Uint8Array(buf))
}

export const app = new (class extends EventEmitter {
  private _ready = false
  private _readyCallbacks: Array<() => void> = []

  markReady(): void {
    this._ready = true
    for (const cb of this._readyCallbacks) cb()
    this._readyCallbacks = []
  }

  whenReady(): Promise<void> {
    if (this._ready) return Promise.resolve()
    return new Promise((resolve) => this._readyCallbacks.push(resolve))
  }

  isPackaged = false

  getPath(name: string): string {
    const paths: Record<string, string> = {
      userData: "/tmp/openwork-userdata",
      appData: "/tmp/openwork-appdata",
      temp: "/tmp",
      home: "/home"
    }
    const p = paths[name] ?? "/tmp"
    if (!fs.existsSync(p)) {
      try {
        fs.mkdirSync(p, { recursive: true })
      } catch {}
    }
    return p
  }

  setAppUserModelId(_id: string): void {}

  get dock() {
    return { setIcon: (_: unknown) => {} }
  }
})()

export type IpcMain = typeof ipcMain
export type IpcRenderer = typeof ipcRenderer
