// What changed from date A to date B, in words (ticket UI10). Rules only, from the same `FrameAnalysis` the sound uses, and every
// word, unit and place comes from the manifest. Each date is read once per region of the data set; the overall change is the mean of
// the regions' changes, so a data set with one region says only that.

import type { FrameAnalysis } from '../analysis'
import { variableWords, type Region, type Visualization } from '../data'
import { signedValue } from './change'
import type { DescribeOptions } from '.'

export type RegionDelta = { region: Region; from: FrameAnalysis; to: FrameAnalysis; change: number }
export type Delta = {
  /** Mean change over the regions that could be read on both dates; null when none could. */
  overall: number | null
  /** The region with the largest change, by size; null when none could be read. */
  top: RegionDelta | null
  /** Changes smaller than this are "little change". In the variable's unit. */
  threshold: number
}

const readable = (result: FrameAnalysis | undefined): result is FrameAnalysis & { medianValue: number } =>
  !!result && result.category !== 'insufficient' && result.medianValue !== undefined

/**
 * Below this a change is "little". The manifest's own idea of "near normal" when it has change steps (the step that holds 0, up to its
 * top), otherwise 2% of the colour scale's range.
 */
export function littleChange(visualization: Visualization): number {
  const near = visualization.mapping.changeSteps?.find(step => step.range[0] <= 0 && step.range[1] > 0)
  if (near) return near.range[1]
  const values = visualization.colorScale.stops.map(stop => stop.value)
  return Math.abs(Math.max(...values) - Math.min(...values)) * 0.02
}

/** `a` and `b` hold one result per region for date A and date B. They are matched by `regionId`, so their order does not matter. */
export function deltaBetween(visualization: Visualization, a: FrameAnalysis[], b: FrameAnalysis[]): Delta {
  const deltas: RegionDelta[] = []
  for (const region of visualization.regions) {
    const from = a.find(result => result.regionId === region.id)
    const to = b.find(result => result.regionId === region.id)
    if (readable(from) && readable(to)) deltas.push({ region, from, to, change: to.medianValue - from.medianValue })
  }
  const top = deltas.reduce<RegionDelta | null>((best, delta) => (!best || Math.abs(delta.change) > Math.abs(best.change) ? delta : best), null)
  const overall = deltas.length ? deltas.reduce((sum, delta) => sum + delta.change, 0) / deltas.length : null
  return { overall, top, threshold: littleChange(visualization) }
}

/** "1.2 °C warmer": the size in the unit, then the manifest's word for the direction. */
function sizeAndWay(change: number, visualization: Visualization): string {
  const words = variableWords(visualization.variable)
  const size = signedValue(Math.abs(change), visualization.variable.unit).replace(/^\+/, '')
  return `${size} ${change < 0 ? words.lower : words.higher}`
}

/**
 * "Overall 1.2 °C warmer. The biggest change was in the north-east, 3.4 °C warmer." Concise is the first sentence only. A change under
 * the threshold is "Little change", and a date with no readable region says so rather than guessing.
 */
export function describeDelta(visualization: Visualization, a: FrameAnalysis[], b: FrameAnalysis[], options: DescribeOptions = {}): string {
  const { overall, top, threshold } = deltaBetween(visualization, a, b)
  if (overall === null || !top) return 'Not enough data on one of these dates to say what changed.'

  const flat = Math.abs(overall) < threshold
  const first = flat ? 'Little change overall.' : `Overall ${sizeAndWay(overall, visualization)}.`
  // A data set with one region has no "biggest" place to name, and concise stops at the overall change.
  if (options.detail === 'concise' || visualization.regions.length < 2) return first
  if (Math.abs(top.change) < threshold) return flat ? 'Little change anywhere.' : first
  return `${first} The biggest change was in ${top.region.name}, ${sizeAndWay(top.change, visualization)}.`
}
