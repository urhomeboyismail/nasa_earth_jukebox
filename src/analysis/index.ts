// Frame analysis contract (docs/PLAN.md §5.2).
// T00 stub: it does not read pixels. It picks a category from the frame's month (January coolest,
// December warmest), and returns "insufficient" when the frame's note mentions missing data.
// T01/T02 (team leader) replace it with real pixel analysis behind these same exports.

import type { CategoryId, ColorScale, Frame, Region, SoundMapping } from '../data'

export type FrameAnalysis = {
  frameId: string
  regionId: string
  sampled: number
  valid: number
  medianValue?: number
  category: CategoryId | 'insufficient'
}

export async function analyzeFrame(frame: Frame, region: Region, _colorScale: ColorScale, mapping: SoundMapping): Promise<FrameAnalysis> {
  const sampled = region.points.length
  if (/missing/i.test(frame.note ?? '')) {
    return { frameId: frame.id, regionId: region.id, sampled, valid: 0, category: 'insufficient' }
  }
  const month = Number(frame.date.slice(5, 7)) || 1
  const categories = mapping.categories
  const category = categories[Math.min(categories.length - 1, Math.floor(((month - 1) * categories.length) / 12))]
  return {
    frameId: frame.id,
    regionId: region.id,
    sampled,
    valid: sampled,
    medianValue: (category.range[0] + category.range[1]) / 2,
    category: category.id,
  }
}

export function analyzeAll(frames: Frame[], region: Region, colorScale: ColorScale, mapping: SoundMapping): Promise<FrameAnalysis[]> {
  return Promise.all(frames.map(frame => analyzeFrame(frame, region, colorScale, mapping)))
}
