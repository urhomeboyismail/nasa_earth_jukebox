import { describe, expect, it } from 'vitest'
import { formatDate, formatMonthYear } from './format'

describe('date formatting', () => {
  it('writes a date out in full', () => {
    expect(formatDate('2024-03-01')).toBe('1 March 2024')
    expect(formatDate('2024-12-15')).toBe('15 December 2024')
  })

  it('gives the month and year for announcements', () => {
    expect(formatMonthYear('2024-03-15')).toBe('March 2024')
  })

  it('does not shift a date across a day or month boundary', () => {
    expect(formatDate('2024-01-01')).toBe('1 January 2024')
    expect(formatMonthYear('2024-12-31')).toBe('December 2024')
  })

  it('returns text that is not a date unchanged', () => {
    expect(formatDate('soon')).toBe('soon')
    expect(formatMonthYear('soon')).toBe('soon')
  })
})
