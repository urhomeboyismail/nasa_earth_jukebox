// What the welcome remembers on this device (F37): that it has been done, which path was chosen, whether the mascot may
// speak and the volume picked in the sound check. Storage can be blocked (private windows), so every access is guarded and
// the choice is also kept in memory for this visit.

import { storedWelcome } from '../../data'
import { readStoredText, useStoredValue, writeStoredText } from '../../hooks/useStoredValue'

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

/** The remembered choice, or "not done". */
export function readWelcome(): WelcomeChoice {
  return parse(readStoredText(WELCOME_KEY)) ?? NOT_DONE
}

/** Merges `change` into the remembered choice. */
export function saveWelcome(change: Partial<WelcomeChoice>) {
  writeStoredText(WELCOME_KEY, JSON.stringify({ ...readWelcome(), ...change }))
}

/** Forgets the choice, so the welcome shows again (F37 T2 uses this for "Show the welcome again"). */
export function resetWelcome() {
  writeStoredText(WELCOME_KEY, null)
}

const parseChoice = (text: string): WelcomeChoice => parse(text) ?? NOT_DONE

export function useWelcome(): WelcomeChoice {
  return useStoredValue(WELCOME_KEY, parseChoice, NOT_DONE)[0]
}

/** The volume chosen in the sound check, for the player to start at. */
export function welcomeVolume(): number | undefined {
  return readWelcome().volume
}
