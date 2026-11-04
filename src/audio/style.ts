// How rich the sound is (docs/PLAN.md §5.7). "Full" adds a chord, slides and a bell (T68); "simple" is just the main note,
// the tick and the cue for missing data. The choice is remembered on this device.

import { useCallback, useState } from 'react'

export type SoundStyle = 'full' | 'simple'

const KEY = 'earth-jukebox:sound-style'

/** The remembered style, or 'full'. Storage can be blocked (private windows), so every access is guarded. */
export function readSoundStyle(): SoundStyle {
  try {
    return localStorage.getItem(KEY) === 'simple' ? 'simple' : 'full'
  } catch {
    return 'full'
  }
}

export function useSoundStyle(): [SoundStyle, (style: SoundStyle) => void] {
  const [style, setStyle] = useState<SoundStyle>(readSoundStyle)
  const choose = useCallback((next: SoundStyle) => {
    setStyle(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Not remembered, but the choice still holds for this visit.
    }
  }, [])
  return [style, choose]
}
