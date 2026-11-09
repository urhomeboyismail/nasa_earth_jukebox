import type { SequenceStep } from '../../audio'
import type { SoundMapping } from '../../data'

/** Gap between the sounds of the legend tour, long enough to hear each one finish. */
export const LEGEND_GAP_MS = 1200

/** One step per category, coolest first, spaced `LEGEND_GAP_MS` apart. Learn's "Play all" and Listen's "Hear the legend" both play these. */
export function legendSteps(mapping: SoundMapping): SequenceStep[] {
  return mapping.categories.map((category, index) => ({ category: category.id, atMs: index * LEGEND_GAP_MS }))
}

/** The label to say when step `index` sounds. */
export function legendLabel(mapping: SoundMapping, index: number): string {
  return mapping.categories[index]?.label ?? ''
}
