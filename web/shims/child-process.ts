import { Bash } from "just-bash"
import EventEmitter from "eventemitter3"
import { ZenFs } from "./web-fs"

export interface SpawnOptions {
  cwd?: string
  env?: Record<string, string>
  stdio?: string | string[]
}

export interface StdioOptions {
  stdio?: string | string[]
}

export interface ChildProcess extends NodeJS.EventEmitter {
  stdout: NodeJS.EventEmitter & { readable: boolean }
  stderr: NodeJS.EventEmitter & { readable: boolean }
  kill(signal?: string): boolean
  readonly pid?: number
}

class FakeReadable extends EventEmitter {
  readable = true
}

export function spawn(cmd: string, args: string[] = [], options: SpawnOptions = {}): ChildProcess {
  const stdout = new FakeReadable()
  const stderr = new FakeReadable()
  const proc = new EventEmitter() as unknown as ChildProcess
  ;(proc as unknown as Record<string, unknown>).stdout = stdout
  ;(proc as unknown as Record<string, unknown>).stderr = stderr

  let killed = false
  ;(proc as unknown as Record<string, unknown>).kill = (): boolean => {
    killed = true
    return true
  }

  const cwd = options.cwd ?? "/"

  let command: string
  if (args[0] === "-c" && args[1]) {
    command = args[1]
  } else if (args[0] === "/c") {
    command = args.slice(1).join(" ")
  } else {
    command = [cmd, ...args].join(" ")
  }

  const bash = new Bash({
    fs: new ZenFs(cwd),
    cwd,
    env: (options.env ?? {}) as Record<string, string>,
    network: { dangerouslyAllowFullInternetAccess: true }
  })

  bash
    .exec(command)
    .then((result) => {
      if (killed) return
      if (result.stdout) stdout.emit("data", Buffer.from(result.stdout))
      if (result.stderr) stderr.emit("data", Buffer.from(result.stderr))
      proc.emit("close", result.exitCode, null)
    })
    .catch((err: Error) => {
      if (!killed) proc.emit("error", err)
    })

  return proc
}

export function exec(
  command: string,
  options: SpawnOptions | ((err: Error | null, stdout: string, stderr: string) => void),
  callback?: (err: Error | null, stdout: string, stderr: string) => void
): ChildProcess {
  if (typeof options === "function") {
    callback = options
    options = {}
  }

  const proc = spawn("/bin/sh", ["-c", command], options as SpawnOptions)

  if (callback) {
    const cb = callback
    let out = ""
    let err = ""
    proc.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString()
    })
    proc.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString()
    })
    proc.on("close", (code: number) => {
      if (code !== 0) cb(new Error(`Command failed: exit ${code}`), out, err)
      else cb(null, out, err)
    })
    proc.on("error", (e: Error) => cb(e, out, err))
  }

  return proc
}

export default { spawn, exec }
