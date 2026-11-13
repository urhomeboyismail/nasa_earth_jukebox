// VIS2: which pattern a category gets. Six patterns that differ without colour (drawn by PatternLayer.tsx).

export const PATTERN_NAMES = ['lines-wide', 'lines-narrow', 'crosshatch', 'dots-small', 'dots-large', 'wavy'] as const
export type PatternName = (typeof PATTERN_NAMES)[number]

/** Ranks 0 to 4, from the coolest category, take the first five patterns; a higher rank takes the large dots. Missing data is the wavy line. */
export function patternFor(category: string, categoryIds: readonly string[]): PatternName {
  const rank = categoryIds.indexOf(category)
  if (rank < 0 || category === 'insufficient') return 'wavy'
  return PATTERN_NAMES[Math.min(rank, 4)]
}
