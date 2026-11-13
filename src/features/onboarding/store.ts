// What the first-minute game remembers on this device (ticket IX11): whether it is done or skipped. Storage can be blocked (private windows), so every access is
// guarded and the flag is also kept in memory for this visit. Same shape as the welcome's store (features/welcome/storage.ts).

import { useSyncExternalStore } from 'react'
import { z } from 'zod'

export const ONBOARDING_KEY = 'earth-jukebox:onboarding'

const stored = z.object({ done: z.boolean() })

let remembered = false
const listeners = new Set<() => void>()

/** Reads the stored text, trusting nothing in it. Anything wrong counts as not done. */
function parse(text: string | null): boolean {
  if (!text) return false
  try {
    const parsed = stored.safeParse(JSON.parse(text))
    return parsed.success && parsed.data.done
  } catch {
    return false
  }
}

/** True once the game was finished or skipped. */
export function readOnboardingDone(): boolean {
  try {
    return parse(localStorage.getItem(ONBOARDING_KEY))
  } catch {
    return remembered
  }
}

function write(done: boolean) {
  remembered = done
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ done }))
  } catch {
    // Not remembered for next time, but the choice still holds for this visit.
  }
  listeners.forEach(listener => listener())
}

/** Finished or skipped: the game is not offered on its own again. */
export const saveOnboardingDone = () => write(true)

/** Offers the game again (the restart button, and the welcome's "Just play me something" path). */
export const resetOnboarding = () => write(false)

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useOnboardingDone(): boolean {
  return useSyncExternalStore(subscribe, readOnboardingDone, () => false)
}
