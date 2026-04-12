export function createCachedLoader<T>(load: () => Promise<T>): () => Promise<T> {
  let cache: Promise<T> | null = null
  return () => {
    if (!cache) cache = load()
    return cache
  }
}
