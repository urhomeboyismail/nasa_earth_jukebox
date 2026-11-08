// How rich the sound is (docs/PLAN.md §5.7). "Full" adds a chord, slides and a bell (T68); "simple" is just the main note,
// the tick and the cue for missing data; "change" (T114) plays the change from normal in three layers (§6.2). The choice is remembered on this device.

import { useCallback, useState } from 'react'

export type SoundStyle = 'full' | 'simple' | 'change'

const KEY = 'earth-jukebox:sound-style'

/** The remembered style, or 'full'. Storage can be blocked (private windows), so every access is guarded. */
export function readSoundStyle(): SoundStyle {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'simple' || stored === 'change' ? stored : 'full'
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

/** The style a data set can actually play: a remembered "change" falls back to "full" where there is no baseline, so v1 data sets never change. */
export function styleFor(style: SoundStyle, changeAvailable: boolean): SoundStyle {
  return style === 'change' && !changeAvailable ? 'full' : style
}
