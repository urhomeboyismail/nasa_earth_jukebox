// What to add to a date's main note: a chord from how the values are spread, a slide when the value changed, a bell when it
// jumped (docs/PLAN.md §5.7). A stub (T64) that adds nothing; T68 gives it its rules, behind the same signature.
// Pure and deterministic: the same results always give the same voicing.

import type { FrameAnalysis } from '../analysis'
import type { SoundMapping } from '../data'
import type { SequenceStep } from '.'

export type Voicing = Pick<SequenceStep, 'pad' | 'glide' | 'bell'>

export function voicingFor(_results: FrameAnalysis[], _index: number, _mapping: SoundMapping): Voicing {
  return {}
}
