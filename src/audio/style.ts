// How rich the sound is (docs/PLAN.md §5.7). "Full" adds a chord, slides and a bell (T68); "simple" is just the main note,
// the tick and the cue for missing data; "change" (T114) plays the change from normal in three layers (§6.2). The choice is remembered on this device.

import { readStored, useStoredValue } from '../hooks/useStoredValue'

export type SoundStyle = 'full' | 'simple' | 'change'

const KEY = 'earth-jukebox:sound-style'

const parseStyle = (stored: string): SoundStyle => (stored === 'simple' || stored === 'change' ? stored : 'full')

/** The remembered style, or 'full'. */
export function readSoundStyle(): SoundStyle {
  return readStored(KEY, parseStyle, 'full')
}

/** The style and a way to choose it. If storage is blocked (private windows) the choice is not remembered for next time, but it still holds on every page for this visit. */
export function useSoundStyle(): [SoundStyle, (style: SoundStyle) => void] {
  return useStoredValue<SoundStyle>(KEY, parseStyle, 'full')
}

/** The style a data set can actually play: a remembered "change" falls back to "full" where there is no baseline, so v1 data sets never change. */
export function styleFor(style: SoundStyle, changeAvailable: boolean): SoundStyle {
  return style === 'change' && !changeAvailable ? 'full' : style
}
