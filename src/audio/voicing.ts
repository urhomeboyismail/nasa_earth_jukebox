// What to add to a date's main note (docs/PLAN.md §5.7, ticket T80): a chord from how the values are spread, a slide when the
// category changed, a bell when it jumped. Pure and deterministic: the same results always give the same voicing.

import type { FrameAnalysis } from '../analysis'
import type { CategoryId, SoundMapping } from '../data'
import type { SequenceStep } from '.'

export type Voicing = Pick<SequenceStep, 'pad' | 'glide' | 'bell'>

/** A category must hold at least this share of the valid values to sound in the chord. */
export const PAD_MIN_SHARE = 0.2
/** At most this many categories sound in the chord, so it stays quiet and consonant. */
export const PAD_MAX_NOTES = 3
/** A move of this many categories or more is a jump and gets the bell. */
export const BELL_STEPS = 2

/**
 * The chord, slide and bell for `results[index]`.
 * - `pad`: the categories holding at least 0.2 of the values (the three biggest if more), coolest first.
 * - `glide`: the date before has data and a different category.
 * - `bell`: the category moved two or more steps since the date before.
 * A date without enough data gets nothing. Glide and bell compare only with the date right before: after a gap, or on the first
 * date, there is no earlier note to slide from, so they stay off. The chord does not depend on the date before, so it still sounds.
 */
export function voicingFor(results: FrameAnalysis[], index: number, mapping: SoundMapping): Voicing {
  const current = results[index]
  if (!current || current.category === 'insufficient') return {}

  const order = mapping.categories.map(category => category.id)
  const voicing: Voicing = {}

  const pad = padFor(current, order)
  if (pad.length) voicing.pad = pad

  const previous = results[index - 1]
  if (previous && previous.category !== 'insufficient') {
    const from = order.indexOf(previous.category)
    const to = order.indexOf(current.category)
    if (from !== -1 && to !== -1) {
      if (from !== to) voicing.glide = true
      if (Math.abs(to - from) >= BELL_STEPS) voicing.bell = true
    }
  }
  return voicing
}

function padFor(result: FrameAnalysis, order: CategoryId[]): CategoryId[] {
  if (!result.shares) return []
  const shares = result.shares
  const big = order
    .map((id, position) => ({ id, position, share: shares[id] ?? 0 }))
    .filter(entry => entry.share >= PAD_MIN_SHARE)
  // Keep the biggest three (a tie keeps the cooler one), then list them coolest first.
  return big
    .sort((a, b) => b.share - a.share || a.position - b.position)
    .slice(0, PAD_MAX_NOTES)
    .sort((a, b) => a.position - b.position)
    .map(entry => entry.id)
}
