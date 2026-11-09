// F33, "What the sound hides": the strict sound has one note for each category (five on the template), and a coarse sound has fewer
// (three). Two neighbouring dates that differ by one step can sound the same in the coarse sound. This finds those, so a listener can hear
// what a coarser sound would lose. Pure and deterministic; it uses only the manifest's own categories, never a particular data set.

import type { CategoryId, SoundMapping } from '../data'

/** How many notes the coarse sound has at most. */
export const COARSE_LEVELS = 3

type Categories = Pick<SoundMapping, 'categories'>['categories']

/**
 * The category whose note stands for `id` in the coarse sound. The categories, coolest first, are split into three runs of
 * neighbours; each run is sounded by its middle category. With three categories or fewer nothing is merged, so it returns `id`.
 */
export function coarseCategory(categories: Categories, id: CategoryId): CategoryId {
  const at = categories.findIndex(category => category.id === id)
  if (at < 0 || categories.length <= COARSE_LEVELS) return id
  const group = (i: number) => Math.floor((i * COARSE_LEVELS) / categories.length)
  const members = categories.map((_, i) => i).filter(i => group(i) === group(at))
  return categories[members[Math.floor((members.length - 1) / 2)]].id
}

/** Two neighbouring dates (indexes into the results) whose strict categories differ but whose coarse notes are the same. */
export type HiddenChange = { from: number; to: number }

/** Every change between neighbouring dates that the coarse sound hides, and how many changes there are in all. Dates without data are skipped. */
export function hiddenChanges(categories: Categories, dateCategories: (CategoryId | 'insufficient')[]): { hidden: HiddenChange[]; changes: number } {
  const hidden: HiddenChange[] = []
  let changes = 0
  for (let i = 1; i < dateCategories.length; i++) {
    const before = dateCategories[i - 1]
    const after = dateCategories[i]
    if (before === 'insufficient' || after === 'insufficient' || before === after) continue
    changes++
    if (coarseCategory(categories, before) === coarseCategory(categories, after)) hidden.push({ from: i - 1, to: i })
  }
  return { hidden, changes }
}
