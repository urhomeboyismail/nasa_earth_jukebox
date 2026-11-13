// A short pulse at each date on phones that support it (Android Chrome), longer for warmer categories.
// Off by default. On browsers without navigator.vibrate it does nothing, the setting is not shown and the player says why in one line (IX10).

import { useCallback } from 'react'
import type { CategoryId, SoundMapping } from '../../data'
import { useStoredValue } from '../../hooks/useStoredValue'
import { patternFor } from '../haptics/patterns'

const STORAGE_KEY = 'earth-jukebox:vibration'

// The shapes of the pulses are in src/features/haptics/patterns.ts (IX10); they are exported from here too, for the callers that already import them.
export { MAX_PULSE_MS, MIN_PULSE_MS, MISSING_PATTERN, patternFor } from '../haptics/patterns'

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
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

const parseOn = (stored: string) => stored === 'on'
const serializeOn = (on: boolean) => (on ? 'on' : 'off')

/** The on/off setting. Off until the listener turns it on, and remembered on this device when storage is available. */
export function useVibrationSetting(): { supported: boolean; enabled: boolean; setEnabled: (on: boolean) => void } {
  const supported = isVibrationSupported()
  const [enabled, setStored] = useStoredValue(STORAGE_KEY, parseOn, false, serializeOn)
  const setEnabled = useCallback((on: boolean) => {
    setStored(on) // with blocked storage the setting just lasts until the page is closed
    if (!on && isVibrationSupported()) navigator.vibrate(0) // stop one that is still going
  }, [setStored])
  return { supported, enabled: supported && enabled, setEnabled }
}
