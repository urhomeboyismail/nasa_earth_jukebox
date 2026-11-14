import { createContext, useContext } from 'react'
import { z } from 'zod'
import { DEFAULT_FLAGS, DISPLAY_STORAGE_KEY, type DisplayFlags } from './flags'

export type DisplaySettings = {
  flags: DisplayFlags
  /** The only setter. Each change is announced. */
  setDisplay: (changes: Partial<DisplayFlags>) => void
  reset: () => void
}

export const DisplaySettingsContext = createContext<DisplaySettings>({ flags: DEFAULT_FLAGS, setDisplay: () => {}, reset: () => {} })

/** The current display settings. Outside a `DisplaySettingsProvider` every switch is off, so components still work alone. */
export function useDisplaySettings(): DisplaySettings {
  return useContext(DisplaySettingsContext)
}

const stored = z.object({ readable: z.boolean(), highContrast: z.boolean(), patterns: z.boolean(), hideCrate: z.boolean() }).partial()

/** What was saved on this device. Anything missing, unreadable or of the wrong shape is ignored. */
export function readStoredFlags(): Partial<DisplayFlags> {
  try {
    const text = localStorage.getItem(DISPLAY_STORAGE_KEY)
    if (!text) return {}
    const parsed = stored.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : {}
  } catch { return {} }
}

/** Blocked storage is fine: the choice then holds for this visit, in the provider's state. */
export function writeStoredFlags(flags: DisplayFlags | null) {
  try {
    if (flags) localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(flags))
    else localStorage.removeItem(DISPLAY_STORAGE_KEY)
  } catch { /* storage is blocked */ }
}

/** The starting settings: the system's wish for more contrast when nothing is saved, then whatever was saved. */
export function startingFlags(useSaved = true): DisplayFlags {
  let more = false
  try { more = window.matchMedia?.('(prefers-contrast: more)').matches ?? false } catch { /* no matchMedia */ }
  return { ...DEFAULT_FLAGS, highContrast: more, ...(useSaved ? readStoredFlags() : {}) }
}
