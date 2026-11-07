// What the right answer is when someone picks their own two dates: compare the categories the analysis gave.

import type { FrameAnalysis } from '../../analysis'
import type { SoundMapping } from '../../data'

export type Answer = 'a' | 'b' | 'same'

/** The mapping, with the change steps when the data set has a baseline (docs/PLAN.md §5.9). */
type JudgeMapping = Omit<SoundMapping, 'changeSteps' | 'contourLevels'> & { changeSteps?: { id: string }[] }

/**
 * Which date is warmer by category, or null when either date has no usable data (so there is no answer to give). When both dates have a
 * `changeStep` the answer is which is further above its normal, by step; otherwise by category, as before. A date whose change could not
 * be read has no answer, even if its category could.
 */
export function judge(a: FrameAnalysis | undefined, b: FrameAnalysis | undefined, mapping: JudgeMapping): Answer | null {
  if (!a || !b || a.category === 'insufficient' || b.category === 'insufficient') return null
  if (a.changeStep && b.changeStep && mapping.changeSteps) {
    if (a.changeStep === 'insufficient' || b.changeStep === 'insufficient') return null
    const step = (result: FrameAnalysis) => mapping.changeSteps!.findIndex(s => s.id === result.changeStep)
    const [sa, sb] = [step(a), step(b)]
    if (sa < 0 || sb < 0) return null
    return sa === sb ? 'same' : sa > sb ? 'a' : 'b'
  }
  const rank = (result: FrameAnalysis) => mapping.categories.findIndex(category => category.id === result.category)
  const [ra, rb] = [rank(a), rank(b)]
  if (ra < 0 || rb < 0) return null
  return ra === rb ? 'same' : ra > rb ? 'a' : 'b'
}

export function categoryLabel(result: FrameAnalysis | undefined, mapping: SoundMapping): string {
  if (!result) return ''
  if (result.category === 'insufficient') return 'not enough data'
  return mapping.categories.find(category => category.id === result.category)?.label.toLowerCase() ?? result.category
}

/** `change` is for a data set with a baseline, where the question is how far each date is above its normal. */
export function answerText(answer: Answer, change = false): string {
  const word = change ? 'further above its normal' : 'warmer'
  return answer === 'a' ? `Date A is ${word}` : answer === 'b' ? `Date B is ${word}` : 'About the same'
}

/** A date's change step in words ("much above"), or "not enough data". */
export function changeStepLabel(result: FrameAnalysis | undefined): string {
  if (!result?.changeStep || result.changeStep === 'insufficient') return 'not enough data'
  return result.changeStep.replace(/[-_]+/g, ' ').trim().toLowerCase()
}

/** What the change is measured against, for the reveal: the baseline's own label, or "its normal" for an anomaly product. */
export function baselineName(baseline: { kind: string; label?: string } | undefined): string {
  return baseline?.label ?? 'its normal'
}
