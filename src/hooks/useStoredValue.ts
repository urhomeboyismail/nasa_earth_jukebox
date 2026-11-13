// One place that reads and writes a setting kept on this device. Storage can be blocked (private windows, some embedded
// browsers), so every access is guarded. When a write is refused, the value is kept in memory, so the choice still holds
// on every page for this visit. Every component that uses the same key sees a change at once.

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/** Values whose write was refused, kept for this visit. A `null` is a remembered "nothing stored". */
const memory = new Map<string, string | null>()
const listeners = new Set<() => void>()

/** The stored text, or null when nothing is stored (or nothing can be read). */
export function readStoredText(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Stores `text`, or forgets the key when `text` is null. If storage refuses, the value is kept in memory for this visit. */
export function writeStoredText(key: string, text: string | null) {
  try {
    if (text === null) localStorage.removeItem(key)
    else localStorage.setItem(key, text)
    memory.delete(key)
  } catch {
    memory.set(key, text)
  }
  listeners.forEach(listener => listener())
}

/** Forgets what was only kept in memory. For tests, which share one page between cases. */
export function forgetKeptValues() {
  memory.clear()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Turns stored text into a value. A missing value, or a `parse` that throws, gives `fallback`. */
function decode<T>(text: string | null, parse: (text: string) => T, fallback: T): T {
  if (text === null) return fallback
  try {
    return parse(text)
  } catch {
    return fallback
  }
}

/** The value now, for code that is not a component. */
export function readStored<T>(key: string, parse: (text: string) => T, fallback: T): T {
  return decode(readStoredText(key), parse, fallback)
}

/** Plain text for a string (so keys written before this hook keep their values), JSON for anything else. */
function defaultSerialize<T>(value: T): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/**
 * A setting kept on this device: `[value, set]`. `parse` and `serialize` should be defined outside the component, so they
 * are the same on every render. `serialize` may return null to forget the key (an "on" that is the default, for instance).
 */
export function useStoredValue<T>(
  key: string,
  parse: (text: string) => T,
  fallback: T,
  serialize: (value: T) => string | null = defaultSerialize,
): [T, (value: T) => void] {
  const text = useSyncExternalStore(subscribe, () => readStoredText(key), () => null)
  const value = useMemo(() => decode(text, parse, fallback), [text, parse, fallback])
  const set = useCallback((next: T) => writeStoredText(key, serialize(next)), [key, serialize])
  return [value, set]
}
