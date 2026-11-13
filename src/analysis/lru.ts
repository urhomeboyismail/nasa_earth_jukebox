// A small least-recently-used cache. A Map keeps insertion order, so the first key is always the one used longest ago.

export type Lru<V> = {
  get: (key: string) => V | undefined
  set: (key: string, value: V) => void
  delete: (key: string) => void
  readonly size: number
}

/** Holds at most `limit` entries. `get` and `set` both count as a use; past the limit the least recently used entry goes. */
export function createLru<V>(limit: number): Lru<V> {
  const entries = new Map<string, V>()
  return {
    get(key) {
      if (!entries.has(key)) return undefined
      const value = entries.get(key) as V
      entries.delete(key)
      entries.set(key, value)
      return value
    },
    set(key, value) {
      entries.delete(key)
      entries.set(key, value)
      if (entries.size > limit) {
        const oldest = entries.keys().next()
        if (!oldest.done) entries.delete(oldest.value)
      }
    },
    delete(key) { entries.delete(key) },
    get size() { return entries.size },
  }
}
