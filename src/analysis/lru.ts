// A small least-recently-used cache. A Map keeps insertion order, so the first key is always the one used longest ago.

export type Lru<V> = {
  get: (key: string) => V | undefined
  set: (key: string, value: V) => void
  delete: (key: string) => void
  readonly size: number
}

/** Holds at most `limit` entries. `get` and `set` both count as a use; past the limit the least recently used entry goes. */
export function createLru<V>(limit: number): Lru<V> {
  // Each value sits in a box, so a stored `undefined` is still told apart from a missing key without a cast.
  const entries = new Map<string, { value: V }>()
  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      entries.delete(key)
      entries.set(key, entry)
      return entry.value
    },
    set(key, value) {
      entries.delete(key)
      entries.set(key, { value })
      if (entries.size > limit) {
        const oldest = entries.keys().next()
        if (!oldest.done) entries.delete(oldest.value)
      }
    },
    delete(key) { entries.delete(key) },
    get size() { return entries.size },
  }
}
