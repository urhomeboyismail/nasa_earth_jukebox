// Whether the mascot shows (F37 T2): the welcome on Home and its face beside the demo caption. On by default; the help button
// stays either way, because it is the way back. Remembered on this device; storage can be blocked, so the choice is also kept
// in memory for this visit.

import { useSyncExternalStore } from 'react'

const KEY = 'earth-jukebox:mascot'

let remembered = true
const listeners = new Set<() => void>()

/** True unless the listener turned the mascot off. */
export function readMascotOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return remembered
  }
}

export function setMascotOn(on: boolean) {
  remembered = on
  try {
    if (on) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, 'off')
  } catch {
    // Not remembered for next time, but the choice still holds for this visit.
  }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useMascotOn(): boolean {
  return useSyncExternalStore(subscribe, readMascotOn, () => true)
}
