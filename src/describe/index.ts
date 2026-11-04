// Words for what is on screen and what is heard (docs/PLAN.md §5.8), for screen readers and for anyone who wants the
// details written down. Stubs (T64) returning a fixed sentence; T69 writes the real rules behind the same signatures.
// Rules only, never a language model: the same data always gives the same words (this folder is guarded by boundary.test.ts).

import type { FrameAnalysis, FrameGrid } from '../analysis'
import type { Visualization } from '../data'

const NOT_BUILT = 'The description is not written yet.'

/** One date: its category, how much could be read, and how it changed since the date before. */
export function describeFrame(_visualization: Visualization, _results: FrameAnalysis[], _index: number): string {
  return NOT_BUILT
}

/** The whole sequence: where it starts and ends, the warmest and coolest dates, the biggest change, the gaps. */
export function describeSequence(_visualization: Visualization, _results: FrameAnalysis[]): string {
  return NOT_BUILT
}

/** One cell of the map: its category and value, and where it is ("north-east, column 19 of 24, row 3 of 11"). */
export function describeCell(_visualization: Visualization, _grid: FrameGrid, _col: number, _row: number): string {
  return NOT_BUILT
}

/** A row or a column of the map, as runs: "Row 3, west to east: land for 4 cells, cool for 6, mild for 8". */
export function describeSweep(_visualization: Visualization, _grid: FrameGrid, _line: { kind: 'row' | 'column'; index: number }): string {
  return NOT_BUILT
}
