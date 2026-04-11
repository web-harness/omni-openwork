export class AsyncLocalStorage<T = unknown> {
  private store: T | undefined

  getStore(): T | undefined {
    return this.store
  }

  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = this.store
    this.store = store
    try {
      return callback(...args)
    } finally {
      this.store = previous
    }
  }

  enterWith(store: T): void {
    this.store = store
  }

  exit<R>(callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = this.store
    this.store = undefined
    try {
      return callback(...args)
    } finally {
      this.store = previous
    }
  }

  disable(): void {
    this.store = undefined
  }
}

export default { AsyncLocalStorage }
