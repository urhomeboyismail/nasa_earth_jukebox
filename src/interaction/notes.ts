// The note of a place (docs/PLAN.md §6.3, ticket IX01), pure and shared by every interaction ticket. A place's note comes from where its value sits on the
// legend, snapped to the data set's preset, in the ruleset's melody range, so the sound a listener makes by hand is in the same key and range as the music.
// None of these functions is written again elsewhere.

import type { ColorScale, MapArea } from '../data'
import type { NoteEvent } from '../audio/ensemble/types'
import { MELODY_LOW_MIDI, MELODY_SPAN } from '../sonify/ranges'
import { snapToScale } from '../sonify/presets'
import type { MusicFrame, Preset } from '../sonify/types'

const MELODY_HIGH_MIDI = MELODY_LOW_MIDI + MELODY_SPAN
const FIFTH = 7
const OCTAVE = 12
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Where a value sits across the legend: 0 at its first stop, 1 at its last. */
export function positionOfValue(value: number, scale: ColorScale): number {
  const first = scale.stops[0].value
  const last = scale.stops[scale.stops.length - 1].value
  return last === first ? 0.5 : clamp01((value - first) / (last - first))
}

/** The melody note for a place's position across the legend (0 to 1). */
export function noteForPosition(position: number, preset: Preset): number {
  return snapToScale(MELODY_LOW_MIDI + clamp01(position) * MELODY_SPAN, preset, MELODY_LOW_MIDI, MELODY_HIGH_MIDI)
}

/** The note a fifth above, in the key. */
export const fifthAbove = (midi: number, preset: Preset) => snapToScale(midi + FIFTH, preset, MELODY_LOW_MIDI, MELODY_HIGH_MIDI)

/** The same note an octave lower. */
export const octaveBelow = (midi: number) => midi - OCTAVE

/** The note of a mark: the top of the melody range. */
export const markNote = (preset: Preset) => snapToScale(MELODY_HIGH_MIDI, preset, MELODY_LOW_MIDI, MELODY_HIGH_MIDI)

/** A frame of music as notes to sound at once (the melody, the chord and the hot spots), for scrubbing, following and predicting. `seconds` is how long each sounds. */
export function notesOf(frame: MusicFrame, seconds: number): NoteEvent[] {
  const notes: NoteEvent[] = []
  if (frame.melody) notes.push({ midi: frame.melody.midi, level: frame.melody.level, pan: 0, seconds })
  if (frame.harmony) for (const midi of frame.harmony.midis) notes.push({ midi, level: frame.harmony.level, pan: 0, seconds })
  for (const spot of frame.hotspots) notes.push({ midi: spot.midi, level: spot.level, pan: spot.pan, elevation: spot.elevation, seconds })
  return notes
}

/**
 * The cell of the sound map for a place given as fractions of the whole image (SN01's hot-spot centres and edges). `area` is the map's part of the image.
 * A place outside the map is clamped to its nearest cell.
 */
export function cellOfFraction(x: number, y: number, area: MapArea, cols: number, rows: number): { col: number; row: number } {
  const across = (x - area.x0) / (area.x1 - area.x0)
  const down = (y - area.y0) / (area.y1 - area.y0)
  return {
    col: Math.min(cols - 1, Math.max(0, Math.floor(across * cols))),
    row: Math.min(rows - 1, Math.max(0, Math.floor(down * rows))),
  }
}
