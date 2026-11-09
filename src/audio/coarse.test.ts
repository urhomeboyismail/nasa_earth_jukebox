import { describe, expect, it } from 'vitest'
import { coarseCategory, hiddenChanges } from './coarse'

const five = ['cold', 'cool', 'mild', 'warm', 'hot'].map(id => ({ id }) as never)

describe('coarseCategory', () => {
  it('sounds five categories as three: cold and cool together, mild and warm together, hot alone', () => {
    expect(['cold', 'cool', 'mild', 'warm', 'hot'].map(id => coarseCategory(five, id))).toEqual(['cold', 'cold', 'mild', 'mild', 'hot'])
  })

  it('merges nothing when there are three categories or fewer, or the category is unknown', () => {
    const three = five.slice(0, 3)
    expect(['cold', 'cool', 'mild'].map(id => coarseCategory(three, id))).toEqual(['cold', 'cool', 'mild'])
    expect(coarseCategory(five, 'nope')).toBe('nope')
  })

  it('is the same every time', () => {
    expect(coarseCategory(five, 'warm')).toBe(coarseCategory(five, 'warm'))
  })
})

describe('hiddenChanges', () => {
  it('finds one-step changes that the coarse sound turns into the same note', () => {
    const result = hiddenChanges(five, ['cold', 'cool', 'mild', 'warm', 'hot'])
    expect(result.changes).toBe(4)
    expect(result.hidden).toEqual([{ from: 0, to: 1 }, { from: 2, to: 3 }])
  })

  it('does not count staying the same, or dates without data', () => {
    const result = hiddenChanges(five, ['cold', 'cold', 'insufficient', 'cool', 'cool', 'hot'])
    expect(result.changes).toBe(1)
    expect(result.hidden).toEqual([])
  })

  it('has nothing to hide when every change is big enough to be heard', () => {
    expect(hiddenChanges(five, ['cold', 'mild', 'hot'])).toEqual({ hidden: [], changes: 2 })
  })
})
