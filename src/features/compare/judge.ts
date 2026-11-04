// What the right answer is when someone picks their own two dates: compare the categories the analysis gave.

import type { FrameAnalysis } from '../../analysis'
import type { SoundMapping } from '../../data'

export type Answer = 'a' | 'b' | 'same'

/** Which date is warmer by category, or null when either date has no usable data (so there is no answer to give). */
export function judge(a: FrameAnalysis | undefined, b: FrameAnalysis | undefined, mapping: SoundMapping): Answer | null {
  if (!a || !b || a.category === 'insufficient' || b.category === 'insufficient') return null
  const rank = (result: FrameAnalysis) => mapping.categories.findIndex(category => category.id === result.category)
  const [ra, rb] = [rank(a), rank(b)]
  if (ra < 0 || rb < 0) return null
  return ra === rb ? 'same' : ra > rb ? 'a' : 'b'
}

export function categoryLabel(result: FrameAnalysis | undefined, mapping: SoundMapping): string {
  if (!result) return ''
  if (result.category === 'insufficient') return 'no data'
  return mapping.categories.find(category => category.id === result.category)?.label.toLowerCase() ?? result.category
}

export function answerText(answer: Answer): string {
  return answer === 'a' ? 'Date A is warmer' : answer === 'b' ? 'Date B is warmer' : 'About the same'
}
