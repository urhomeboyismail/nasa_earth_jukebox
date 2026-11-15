// The listener's sound preferences (docs/planning/UIUX-BLUEPRINT.md §1.5): a music style, the Bass setting, the speed and the voices they muted.
// Set in the welcome and in the Listen mixer, which read and write this one store. Kept on this device; storage can be blocked (private windows),
// so every access is guarded and the choice is also kept in memory for this visit. Same pattern as src/features/welcome/storage.ts.
// shortcut: one set of preferences for every data set; add a per-data-set override if listeners ask for it.
// Which preset plays is one rule, `presetIdFor` (SN15): a data set's own preset wins over a style picked in the welcome, and only a style picked
// in the Listen mixer (`styleEverywhere`) plays over every data set.

import { useSyncExternalStore } from 'react'
import { storedAudioPrefs, type PresetId, type VoiceId } from '../data'

export type AudioPrefs = {
  /** null: the data set's own preset. With `styleEverywhere` false it is only a default, for data sets without a preset of their own. */
  style: PresetId | null
  /** −6 to +6 dB, added to the bass voice. */
  bassDb: number
  speed: 'slow' | 'normal' | 'fast'
  /** Never contains 'melody'. */
  muted: VoiceId[]
  /** The listener's left and right are swapped, so every pan is flipped (the ear check, UI07). */
  swapEars: boolean
  /** The style plays over every data set's own preset: true once it is chosen in the Listen mixer (SN15). */
  styleEverywhere: boolean
}

export const AUDIO_PREFS_KEY = 'earth-jukebox:audio-prefs'
export const DEFAULT_AUDIO_PREFS: AudioPrefs = { style: null, bassDb: 0, speed: 'normal', muted: [], swapEars: false, styleEverywhere: false }

/**
 * The preset that plays (SN15): a style chosen in the Listen mixer over every data set; otherwise the data set's own preset; otherwise the style
 * chosen in the welcome, as a default; otherwise Major. A preset never carries data, so this only picks the artistic choice.
 */
export function presetIdFor(prefs: Pick<AudioPrefs, 'style' | 'styleEverywhere'>, own: PresetId | undefined): PresetId {
  if (prefs.styleEverywhere && prefs.style) return prefs.style
  return own ?? prefs.style ?? 'major'
}

let remembered: AudioPrefs = DEFAULT_AUDIO_PREFS
const listeners = new Set<() => void>()

function parse(text: string | null): AudioPrefs | null {
  if (!text) return null
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = storedAudioPrefs.safeParse(value)
  return parsed.success ? parsed.data : null
}

let lastText: string | null | undefined
let lastPrefs: AudioPrefs = DEFAULT_AUDIO_PREFS
/** The stored preferences, or the defaults. The same object until something changes, so it can feed a store. */
export function readAudioPrefs(): AudioPrefs {
  let text: string | null
  try {
    text = localStorage.getItem(AUDIO_PREFS_KEY)
  } catch {
    return remembered
  }
  if (text !== lastText) {
    lastText = text
    lastPrefs = parse(text) ?? DEFAULT_AUDIO_PREFS
  }
  return lastPrefs
}

/** Merges `change` into the preferences and tells every reader. */
export function saveAudioPrefs(change: Partial<AudioPrefs>) {
  const next = { ...readAudioPrefs(), ...change }
  remembered = parse(JSON.stringify(next)) ?? DEFAULT_AUDIO_PREFS
  try {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(remembered))
  } catch {
    // Not kept for next time, but the choice still holds for this visit.
    lastPrefs = remembered
  }
  listeners.forEach(listener => listener())
}

/** Back to the data set's own sound. */
export function resetAudioPrefs() {
  remembered = DEFAULT_AUDIO_PREFS
  try {
    localStorage.removeItem(AUDIO_PREFS_KEY)
  } catch {
    lastPrefs = DEFAULT_AUDIO_PREFS
  }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useAudioPrefs(): AudioPrefs {
  return useSyncExternalStore(subscribe, readAudioPrefs, () => DEFAULT_AUDIO_PREFS)
}
