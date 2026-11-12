// What the welcome remembers on this device (F37): that it has been done, which path was chosen, whether the mascot may
// speak and the volume picked in the sound check. Storage can be blocked (private windows), so every access is guarded and
// the choice is also kept in memory for this visit.

import { useSyncExternalStore } from 'react'
import { storedWelcome } from '../../data'

export type WelcomePath = 'screen-reader' | 'map' | 'play'

export type WelcomeChoice = {
  done: boolean
  path?: WelcomePath
  /** The mascot may read its lines aloud (only ever set by a click on "I can see the map"). */
  speech: boolean
  /** 0 to 1, chosen in the sound check. */
  volume?: number
}

export const WELCOME_KEY = 'earth-jukebox:welcome'

const NOT_DONE: WelcomeChoice = { done: false, speech: false }

let remembered: WelcomeChoice = NOT_DONE
const listeners = new Set<() => void>()

/** Reads the stored text into a choice, trusting nothing in it. */
function parse(text: string | null): WelcomeChoice | null {
  if (!text) return null
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = storedWelcome.safeParse(value)
  if (!parsed.success) return null
  const { done, speech, path, volume } = parsed.data
  // Fields that fell back are left out rather than stored as `undefined`.
  return { done, speech, ...(path && { path }), ...(volume !== undefined && { volume }) }
}

/** The remembered choice, or "not done". Returns the same object until something changes, so it can feed a store. */
let lastText: string | null | undefined
let lastChoice: WelcomeChoice = NOT_DONE
export function readWelcome(): WelcomeChoice {
  let text: string | null
  try {
    text = localStorage.getItem(WELCOME_KEY)
  } catch {
    return remembered
  }
  if (text !== lastText) {
    lastText = text
    lastChoice = parse(text) ?? NOT_DONE
  }
  return lastChoice
}

/** Merges `change` into the remembered choice. */
export function saveWelcome(change: Partial<WelcomeChoice>) {
  remembered = { ...readWelcome(), ...change }
  try {
    localStorage.setItem(WELCOME_KEY, JSON.stringify(remembered))
  } catch {
    // Not remembered for next time, but the choice still holds for this visit.
  }
  listeners.forEach(listener => listener())
}

/** Forgets the choice, so the welcome shows again (F37 T2 uses this for "Show the welcome again"). */
export function resetWelcome() {
  remembered = NOT_DONE
  try {
    localStorage.removeItem(WELCOME_KEY)
  } catch {
    // Nothing stored that could be removed.
  }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useWelcome(): WelcomeChoice {
  return useSyncExternalStore(subscribe, readWelcome, () => NOT_DONE)
}

/** The volume chosen in the sound check, for the player to start at. */
export function welcomeVolume(): number | undefined {
  return readWelcome().volume
}
