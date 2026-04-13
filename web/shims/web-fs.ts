import * as fs from "fs"
import * as nodePath from "path"
import createDebug from "debug"

const debug = createDebug("omni:web:fs")

import type {
  BufferEncoding,
  CpOptions,
  FileContent,
  FsStat,
  IFileSystem,
  MkdirOptions,
  RmOptions
} from "just-bash"

interface ReadFileOptions {
  encoding?: BufferEncoding | null
}

function getEncoding(opts?: ReadFileOptions | BufferEncoding): BufferEncoding {
  if (!opts) return "utf8"
  if (typeof opts === "string") return opts as BufferEncoding
  return ((opts as ReadFileOptions).encoding || "utf8") as BufferEncoding
}

function fromBuffer(buf: Uint8Array, enc: BufferEncoding): string {
  if (enc === "utf8" || enc === "utf-8") return new TextDecoder("utf-8").decode(buf)
  return Buffer.from(buf).toString(enc)
}

export class ZenFs implements IFileSystem {
  private readonly root: string

  constructor(root = "/") {
    this.root = nodePath.resolve(root)
  }

  private real(p: string): string {
    const norm = this.normalize(p)
    if (this.root === "/" || this.root === nodePath.sep) return norm
    return nodePath.resolve(nodePath.join(this.root, norm))
  }

  private normalize(p: string): string {
    if (!p || p === "/") return "/"
    let s = p.endsWith("/") && p !== "/" ? p.slice(0, -1) : p
    if (!s.startsWith("/")) s = `/${s}`
    const parts = s.split("/").filter((x) => x && x !== ".")
    const out: string[] = []
    for (const part of parts) {
      if (part === "..") out.pop()
      else out.push(part)
    }
    return `/${out.join("/")}`
  }

  async readFile(p: string, opts?: ReadFileOptions | BufferEncoding): Promise<string> {
    return fromBuffer(await this.readFileBuffer(p), getEncoding(opts))
  }

  async readFileBuffer(p: string): Promise<Uint8Array> {
    const buf = fs.readFileSync(this.real(p))
    return new Uint8Array(buf instanceof Buffer ? buf : Buffer.from(buf))
  }

  async writeFile(p: string, content: FileContent): Promise<void> {
    const dir = nodePath.dirname(this.real(p))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.real(p), content as Parameters<typeof fs.writeFileSync>[1])
  }

  async appendFile(p: string, content: FileContent): Promise<void> {
    const dir = nodePath.dirname(this.real(p))
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(this.real(p), content as Parameters<typeof fs.appendFileSync>[1])
  }

  async exists(p: string): Promise<boolean> {
    return fs.existsSync(this.real(p))
  }

  async stat(p: string): Promise<FsStat> {
    const s = fs.statSync(this.real(p))
    return {
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      isSymbolicLink: false,
      mode: s.mode,
      size: s.size,
      mtime: s.mtime
    }
  }

  async lstat(p: string): Promise<FsStat> {
    const s = fs.lstatSync(this.real(p))
    return {
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      isSymbolicLink: s.isSymbolicLink(),
      mode: s.mode,
      size: s.size,
      mtime: s.mtime
    }
  }

  async mkdir(p: string, opts?: MkdirOptions): Promise<void> {
    fs.mkdirSync(this.real(p), { recursive: opts?.recursive })
  }

  async readdir(p: string): Promise<string[]> {
    return fs.readdirSync(this.real(p)) as string[]
  }

  async readdirWithFileTypes(
    p: string
  ): Promise<
    Array<{ name: string; isFile: boolean; isDirectory: boolean; isSymbolicLink: boolean }>
  > {
    return fs.readdirSync(this.real(p), { withFileTypes: true }).map((d) => ({
      name: d.name,
      isFile: d.isFile(),
      isDirectory: d.isDirectory(),
      isSymbolicLink: d.isSymbolicLink()
    }))
  }

  async rm(p: string, opts?: RmOptions): Promise<void> {
    fs.rmSync(this.real(p), { recursive: opts?.recursive ?? false, force: opts?.force ?? false })
  }

  async cp(src: string, dest: string, opts?: CpOptions): Promise<void> {
    fs.cpSync(this.real(src), this.real(dest), { recursive: opts?.recursive ?? false })
  }

  async mv(src: string, dest: string): Promise<void> {
    const destDir = nodePath.dirname(this.real(dest))
    fs.mkdirSync(destDir, { recursive: true })
    try {
      fs.renameSync(this.real(src), this.real(dest))
    } catch {
      await this.cp(src, dest, { recursive: true })
      await this.rm(src, { recursive: true })
    }
  }

  resolvePath(base: string, p: string): string {
    if (p.startsWith("/")) return this.normalize(p)
    return this.normalize(base === "/" ? `/${p}` : `${base}/${p}`)
  }

  getAllPaths(): string[] {
    const out: string[] = []
    const walk = (dir: string, vdir: string) => {
      try {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const vp = vdir === "/" ? `/${e.name}` : `${vdir}/${e.name}`
          out.push(vp)
          if (e.isDirectory()) walk(nodePath.join(dir, e.name), vp)
        }
      } catch (e) {
        debug("error: %O", e)

        return
      }
    }
    walk(this.root, "/")
    return out
  }

  async chmod(p: string, mode: number): Promise<void> {
    await fs.promises.chmod(this.real(p), mode)
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    const realLink = this.real(linkPath)
    const linkDir = nodePath.dirname(realLink)
    const resolvedTarget = target.startsWith("/")
      ? nodePath.join(this.root, target)
      : nodePath.relative(linkDir, nodePath.join(this.root, nodePath.dirname(linkPath), target))
    fs.symlinkSync(resolvedTarget, realLink)
  }

  async link(existing: string, newPath: string): Promise<void> {
    fs.linkSync(this.real(existing), this.real(newPath))
  }

  async readlink(p: string): Promise<string> {
    return fs.readlinkSync(this.real(p))
  }

  async realpath(p: string): Promise<string> {
    const resolved = fs.realpathSync(this.real(p))
    const rootReal = fs.realpathSync(this.root)
    if (resolved.startsWith(rootReal)) return resolved.slice(rootReal.length) || "/"
    throw Object.assign(new Error(`ENOENT: ${p}`), { code: "ENOENT" })
  }

  async utimes(p: string, atime: Date, mtime: Date): Promise<void> {
    fs.utimesSync(this.real(p), atime, mtime)
  }
}
