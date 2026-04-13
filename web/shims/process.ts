import { Duplex } from "stream"
import * as constants from "constants-browserify"
import EventEmitter from "eventemitter3"

function makeStream(isError: boolean): Duplex {
  const s = new Duplex()
  s._read = (): void => {
    return
  }
  s._write = (chunk: unknown, _enc: BufferEncoding, cb: (err?: Error | null) => void): void => {
    if (isError) console.error(String(chunk))
    else console.log(String(chunk))
    cb()
  }
  return s
}

let _stdout: Duplex | undefined
let _stderr: Duplex | undefined

declare const __BUILD_NODE_VERSION__: string

const NS = 1e9
const perf = globalThis.performance || {}
const now: () => number = (perf as Record<string, unknown>).now
  ? () => (perf as Performance).now()
  : () => Date.now()

const hrtime = (prev?: [number, number]): [number, number] => {
  const t = now() * 1e-3
  let s = Math.floor(t)
  let ns = Math.floor((t % 1) * NS)
  if (prev) {
    s -= prev[0]
    ns -= prev[1]
    if (ns < 0) {
      s--
      ns += NS
    }
  }
  return [s, ns]
}
hrtime.bigint = (prev?: [number, number]): number => {
  const [s, ns] = hrtime(prev)
  return s * NS + ns
}

export default new (class extends EventEmitter {
  env: Record<string, string | undefined> = {}
  hrtime = hrtime
  platform = "web"
  version = `v${__BUILD_NODE_VERSION__}`
  versions = { node: __BUILD_NODE_VERSION__, electron: "web", chrome: "web" }
  exitCode = 0
  argv: string[] = []
  _cwd = "/"

  cwd(): string {
    return this._cwd
  }
  chdir(dir: string): void {
    this._cwd = dir
  }

  exit(code: number): void {
    this.exitCode = code
  }

  nextTick(fn: (...a: unknown[]) => void, ...args: unknown[]): void {
    Promise.resolve()
      .then(() => fn(...args))
      .catch((e) => this.emit("uncaughtException", e))
  }

  binding(name: string): unknown {
    if (name === "constants") return constants
    throw new Error(`process.binding("${name}") not supported`)
  }

  get stdout(): Duplex {
    if (!_stdout) _stdout = makeStream(false)
    return _stdout
  }

  get stderr(): Duplex {
    if (!_stderr) _stderr = makeStream(true)
    return _stderr
  }
})()
