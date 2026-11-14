// What the "Two data sets" mode needs besides the music (docs/planning/UIUX-BLUEPRINT.md §3.2): which frames both data sets cover. No JSX.

import type { Frame, Visualization } from '../../data'

/** The dates both data sets cover: A's frames inside B's date range, and B's inside A's. Empty when they do not overlap. */
export function overlap(a: Visualization, b: Visualization): { a: Frame[]; b: Frame[] } {
  const range = (v: Visualization) => {
    const dates = v.frames.map(f => f.date).sort()
    return [dates[0], dates[dates.length - 1]] as const
  }
  const [aFrom, aTo] = range(a)
  const [bFrom, bTo] = range(b)
  const from = aFrom > bFrom ? aFrom : bFrom
  const to = aTo < bTo ? aTo : bTo
  const inside = (f: Frame) => f.date >= from && f.date <= to
  const sorted = (frames: Frame[]) => [...frames].sort((x, y) => x.date.localeCompare(y.date))
  return from > to ? { a: [], b: [] } : { a: sorted(a.frames.filter(inside)), b: sorted(b.frames.filter(inside)) }
}

/** B's frame for a date of A: the last one on or before it (the overlap starts at a date both have, so there is always one). */
export function frameOn(frames: Frame[], date: string): Frame {
  let found = frames[0]
  for (const frame of frames) if (frame.date <= date) found = frame
  return found
}
