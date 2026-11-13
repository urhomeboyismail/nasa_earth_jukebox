// The data sets opened most recently on this device, newest first, for "Continue where you left off". Storage can be blocked, so every access is guarded.

const KEY = 'earth-jukebox:recent'
export const MAX_RECENT = 3

export function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

export function rememberRecent(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...readRecent().filter(other => other !== id)].slice(0, MAX_RECENT)))
  } catch {
    // Not remembered; the crate still lists everything.
  }
}
