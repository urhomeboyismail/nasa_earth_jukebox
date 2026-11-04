// A short pulse at each date on phones that support it (Android Chrome), longer for warmer categories.
// Off by default. On browsers without navigator.vibrate it does nothing, and the setting is not shown.

import { useCallback, useState } from 'react'
import type { CategoryId, SoundMapping } from '../../data'

const STORAGE_KEY = 'earth-jukebox:vibration'

export const MIN_PULSE_MS = 30
export const MAX_PULSE_MS = 120
/** Missing data is two quick taps, so it feels different from every category. */
export const MISSING_PATTERN = [25, 60, 25]

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** The pattern for a category: the coolest gets the shortest pulse and the warmest the longest. */
export function patternFor(category: CategoryId | 'insufficient', mapping: SoundMapping): number[] {
  if (category === 'insufficient') return MISSING_PATTERN
  const rank = mapping.categories.findIndex(c => c.id === category)
  if (rank < 0) return []
  const last = mapping.categories.length - 1
  const share = last === 0 ? 0 : rank / last
  return [Math.round(MIN_PULSE_MS + share * (MAX_PULSE_MS - MIN_PULSE_MS))]
}

/** Vibrates for a date. Returns whether it asked the phone to vibrate. */
export function vibrateForDate(category: CategoryId | 'insufficient' | null, mapping: SoundMapping): boolean {
  if (!category || !isVibrationSupported()) return false
  const pattern = patternFor(category, mapping)
  if (!pattern.length) return false
  try {
    return navigator.vibrate(pattern)
  } catch {
    return false
  }
}

function readSetting(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

/** The on/off setting. Off until the listener turns it on, and remembered on this device when storage is available. */
export function useVibrationSetting(): { supported: boolean; enabled: boolean; setEnabled: (on: boolean) => void } {
  const supported = isVibrationSupported()
  const [enabled, setEnabledState] = useState(() => supported && readSetting())
  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on)
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
    } catch {
      // Private mode or blocked storage: the setting just lasts until the page is closed.
    }
    if (!on && isVibrationSupported()) navigator.vibrate(0) // stop one that is still going
  }, [])
  return { supported, enabled: supported && enabled, setEnabled }
}
