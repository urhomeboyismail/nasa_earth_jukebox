// "What's here?" on demand (ticket IX02): which level of words a question gets, and the words. Pure: useExplorer.ts keeps the time of the last
// question and says the answer. The words come from src/describe/, so nothing here names a data set.

import type { FrameGrid } from '../../analysis'
import type { Visualization } from '../../data'
import { describeCell, describePlace } from '../../describe'
import type { Detail } from '../../describe/detail'

/** A second question within this long gets level 2; after it, the next question starts again. */
export const QUERY_REPEAT_MS = 4000

/** `brief` starts at level 1 (what the place shows), `full` at level 2 (where it is). Kept under this key on the device. */
export type Verbosity = 'brief' | 'full'
export const VERBOSITY_KEY = 'earth-jukebox:verbosity'

export type QueryLevel = 1 | 2
/** The last question: when it was asked and the level it got. */
export type LastQuery = { at: number; level: QueryLevel }

/** A stored value as a verbosity: anything but "full" (nothing stored, an old or broken value) is "brief". */
export const parseVerbosity = (stored: string | null): Verbosity => (stored === 'full' ? 'full' : 'brief')

export const startLevel = (verbosity: Verbosity): QueryLevel => (verbosity === 'full' ? 2 : 1)

/** The level for a question asked at `now`. A clock that went backwards starts again rather than counting as "within 4 s". */
export function nextLevel(previous: LastQuery | null, now: number, verbosity: Verbosity = 'brief'): QueryLevel {
  if (previous && now >= previous.at && now - previous.at < QUERY_REPEAT_MS) return 2
  return startLevel(verbosity)
}

/**
 * The answer at one level. Level 1 is the place in the data set's own words (`describeCell`). Level 2 is where it is (`describePlace`); SN10's
 * hot-spot sentences need a frame's features, which the sound map does not read, so they are not added here.
 */
export function whatsHereText(visualization: Visualization, grid: FrameGrid, col: number, row: number, level: QueryLevel, detail: Detail): string {
  if (level === 1) return describeCell(visualization, grid, col, row, { detail })
  const place = describePlace(grid, col, row)
  return `${place.charAt(0).toUpperCase()}${place.slice(1)}.`
}
