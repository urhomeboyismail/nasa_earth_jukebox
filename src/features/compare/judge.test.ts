import { describe, expect, it } from 'vitest'
import type { FrameAnalysis } from '../../analysis'
import type { SoundMapping } from '../../data'
import fixture from '../../../public/data/fixture/manifest.json'
import { answerText, baselineName, changeStepLabel, judge } from './judge'

const mapping = {
  ...(fixture as unknown as { mapping: SoundMapping }).mapping,
  changeSteps: [{ id: 'below' }, { id: 'near-normal' }, { id: 'above' }, { id: 'much-above' }],
}
const result = (category: string, changeStep?: string): FrameAnalysis =>
  ({ frameId: 'f', regionId: 'r', sampled: 9, valid: 9, category, ...(changeStep && { changeStep }) }) as FrameAnalysis

describe('judge', () => {
  it('ranks by category when the dates have no change step, as before', () => {
    expect(judge(result('hot'), result('cold'), mapping)).toBe('a')
    expect(judge(result('cold'), result('hot'), mapping)).toBe('b')
    expect(judge(result('mild'), result('mild'), mapping)).toBe('same')
  })

  it('ranks by change step when both dates have one, even where the categories say the opposite', () => {
    expect(judge(result('cold', 'much-above'), result('hot', 'below'), mapping)).toBe('a')
    expect(judge(result('hot', 'below'), result('cold', 'above'), mapping)).toBe('b')
    expect(judge(result('cold', 'above'), result('hot', 'above'), mapping)).toBe('same')
  })

  it('falls back to category when only one date has a change step', () => {
    expect(judge(result('hot', 'below'), result('cold'), mapping)).toBe('a')
  })

  it('has no answer when a change could not be read, or a category could not', () => {
    expect(judge(result('hot', 'insufficient'), result('cold', 'above'), mapping)).toBeNull()
    expect(judge(result('hot', 'above'), result('insufficient', 'above'), mapping)).toBeNull()
    expect(judge(undefined, result('cold'), mapping)).toBeNull()
  })

  it('has no answer for a change step the data set does not have', () => {
    expect(judge(result('hot', 'huge'), result('cold', 'above'), mapping)).toBeNull()
  })
})

describe('words', () => {
  it('says "further above its normal" for the change question and "warmer" otherwise', () => {
    expect(answerText('a')).toBe('Date A is warmer')
    expect(answerText('b', true)).toBe('Date B is further above its normal')
    expect(answerText('same', true)).toBe('About the same')
  })

  it('names the change step and the baseline', () => {
    expect(changeStepLabel(result('hot', 'much-above'))).toBe('much above')
    expect(changeStepLabel(result('hot', 'insufficient'))).toBe('not enough data')
    expect(baselineName({ kind: 'climatology', label: 'the 1991 to 2020 average' })).toBe('the 1991 to 2020 average')
    expect(baselineName({ kind: 'anomaly-product' })).toBe('its normal')
    expect(baselineName(undefined)).toBe('its normal')
  })
})
