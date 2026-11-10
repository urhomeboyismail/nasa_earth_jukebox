// What the feature extractor is asked for each frame, live or stepped (docs/PLAN.md §6.3, ticket SN06). Shared by both sources, so a video frame and a
// checked frame of the same date are read with the same rules. Only the colour tolerance differs: video colours shift a little (H.264), the PNGs do not.

import type { Visualization } from '../../data'
import { legendOf } from '../../data/sonification'
import { baselineSource } from '..'
import type { Pixels } from '../analyze'
import type { ExtractInput } from '../features/types'
import { readPixels, rememberLast } from '../pixels'

const WHOLE_IMAGE = { x0: 0, y0: 0, x1: 1, y1: 1 }

/** The checked pictures the sources read (baselines and PNG frames), the last two kept. */
export const defaultLoadPixels = rememberLast(readPixels)

/** Everything in an extractor request except the baseline. */
export function baseInput(v: Visualization, frameId: string, date: string, colourTolerance: number): Omit<ExtractInput, 'baseline'> {
  return { frameId, date, mode: legendOf(v), colorScale: v.colorScale, mapping: v.mapping, area: v.mapArea ?? WHOLE_IMAGE, colourTolerance }
}

/**
 * The data set's normal for the frame of `date`, read from the checked files, or undefined when the data set has no baseline or has no checked
 * frame for that date (a video can have more frames than the checked set). An anomaly product has no picture to read: the frame already is the change.
 */
export async function baselineFor(v: Visualization, date: string, loadPixels: (url: string) => Promise<Pixels>): Promise<ExtractInput['baseline']> {
  const frame = v.frames.find(f => f.date === date)
  if (!frame || !v.baseline) return undefined
  try {
    const source = baselineSource(frame, v)
    if (!source) return undefined
    return { pixels: source.image === null ? null : await loadPixels(source.image), noiseFloor: source.noiseFloor }
  } catch {
    // A climatology frame without its normal picture: read the frame without a change rather than not at all.
    return undefined
  }
}
