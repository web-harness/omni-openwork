class Store<T extends Record<string, unknown> = Record<string, unknown>> {
  private data: Map<string, unknown> = new Map()
  private name: string

  constructor(options?: { name?: string; cwd?: string }) {
    this.name = options?.name ?? "store"
    this.loadFromLocalStorage()
  }

  private getKey(): string {
    return `openwork-store:${this.name}`
  }

  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(this.getKey())
      if (stored) {
        const parsed = JSON.parse(stored)
        this.data = new Map(Object.entries(parsed))
      }
    } catch {}
  }

  private persist(): void {
    try {
      localStorage.setItem(this.getKey(), JSON.stringify(Object.fromEntries(this.data)))
    } catch {}
  }

  get<K extends keyof T>(key: K): T[K] | undefined
  get<K extends keyof T>(key: K, defaultValue: T[K]): T[K]
  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] | undefined {
    const val = this.data.get(key as string)
    return val !== undefined ? (val as T[K]) : defaultValue
  }

  set<K extends keyof T>(key: K, value: T[K]): void
  set(object: Partial<T>): void
  set<K extends keyof T>(keyOrObject: K | Partial<T>, value?: T[K]): void {
    if (typeof keyOrObject === "object") {
      for (const [k, v] of Object.entries(keyOrObject)) {
        this.data.set(k, v)
      }
    } else {
      this.data.set(keyOrObject as string, value)
    }
    this.persist()
  }

  has<K extends keyof T>(key: K): boolean {
    return this.data.has(key as string)
  }

  delete<K extends keyof T>(key: K): void {
    this.data.delete(key as string)
    this.persist()
  }

  clear(): void {
    this.data.clear()
    this.persist()
  }

  get store(): T {
    return Object.fromEntries(this.data) as T
  }

  set store(value: T) {
    this.data = new Map(Object.entries(value))
    this.persist()
  }

  get size(): number {
    return this.data.size
  }

  static initRenderer(): void {}
}

export default Store
