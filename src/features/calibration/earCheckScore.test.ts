import { describe, expect, it } from 'vitest'
import { parseDetail, scoreEarCheck, type HigherAnswer, type SideAnswer } from './earCheckScore'

describe('scoreEarCheck', () => {
  it('right pitch and left heard on the left: Standard, not swapped', () => {
    expect(scoreEarCheck({ higher: 'second', side: 'left' })).toEqual({ detail: 'standard', swapEars: false })
  })

  it('right pitch and left heard on the right: Standard, swapped', () => {
    expect(scoreEarCheck({ higher: 'second', side: 'right' })).toEqual({ detail: 'standard', swapEars: true })
  })

  it("the wrong pitch or \"can't tell\" on either question: Calm, never swapped", () => {
    const highers: HigherAnswer[] = ['first', 'second', 'unsure']
    const sides: SideAnswer[] = ['left', 'right', 'unsure']
    for (const higher of highers) for (const side of sides) {
      const result = scoreEarCheck({ higher, side })
      if (higher === 'second' && side !== 'unsure') continue
      expect(result).toEqual({ detail: 'calm', swapEars: false })
    }
  })

  it('never suggests Full', () => {
    for (const higher of ['first', 'second', 'unsure'] as const) for (const side of ['left', 'right', 'unsure'] as const) {
      expect(scoreEarCheck({ higher, side }).detail).not.toBe('full')
    }
  })
})

describe('parseDetail', () => {
  it('accepts a level and rejects anything else', () => {
    expect(parseDetail('full')).toBe('full')
    expect(parseDetail('loud')).toBeNull()
  })
})
