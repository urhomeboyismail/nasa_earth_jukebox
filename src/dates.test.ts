import { describe, expect, it } from 'vitest'
import { dateFormatterFor, formatDate, granularityOf } from './dates'

describe('how much of a date to show', () => {
  it('shows the day when frames are close together', () => {
    expect(granularityOf(['2024-01-15', '2024-01-20', '2024-02-15'])).toBe('day')
  })

  it('shows the month when each frame is in a different month', () => {
    expect(granularityOf(['2024-01-15', '2024-02-15', '2024-03-15'])).toBe('month')
    expect(granularityOf(['2024-01-15', '2024-07-15', '2025-03-15'])).toBe('month')
  })

  it('shows the year when each frame is in a different year, however far apart', () => {
    expect(granularityOf(['2022-09-15', '2023-09-18', '2024-09-11'])).toBe('year')
    expect(granularityOf(['2016-01-01', '2018-06-01', '2020-03-01'])).toBe('year')
  })

  it('shows the day for one frame, for repeated dates, and when nothing can be read', () => {
    expect(granularityOf(['2024-01-15'])).toBe('day')
    expect(granularityOf(['2024-01-15', '2024-01-15'])).toBe('day')
    expect(granularityOf([])).toBe('day')
    expect(granularityOf(['soon', 'later'])).toBe('day')
  })

  it('ignores text that is not a date', () => {
    expect(granularityOf(['2023-09-15', 'soon', '2024-09-15'])).toBe('year')
  })

  it('does not depend on the order of the dates', () => {
    expect(granularityOf(['2024-03-15', '2024-01-15', '2024-02-15'])).toBe('month')
  })
})

describe('date formatting', () => {
  it('writes a date out in full by default', () => {
    expect(formatDate('2024-03-01')).toBe('1 March 2024')
    expect(formatDate('2024-12-15')).toBe('15 December 2024')
  })

  it('gives the month and year, or the year alone, when asked', () => {
    expect(formatDate('2024-03-15', 'month')).toBe('March 2024')
    expect(formatDate('2024-03-15', 'year')).toBe('2024')
  })

  it('does not shift a date across a day, month or year boundary', () => {
    expect(formatDate('2024-01-01')).toBe('1 January 2024')
    expect(formatDate('2024-12-31', 'month')).toBe('December 2024')
    expect(formatDate('2025-01-01', 'year')).toBe('2025')
    expect(formatDate('2024-12-31', 'year')).toBe('2024')
  })

  it('returns text that is not a date unchanged', () => {
    expect(formatDate('soon')).toBe('soon')
    expect(formatDate('soon', 'month')).toBe('soon')
    expect(formatDate('soon', 'year')).toBe('soon')
  })
})

describe('a formatter for one dataset', () => {
  it('writes every date at the same level of detail', () => {
    const monthly = dateFormatterFor(['2024-01-15', '2024-02-15', '2024-03-15'])
    expect(['2024-01-15', '2024-02-15', '2024-03-15'].map(monthly)).toEqual(['January 2024', 'February 2024', 'March 2024'])
  })

  it('uses years for a yearly set and days for a daily one', () => {
    expect(dateFormatterFor(['2023-09-15', '2024-09-15'])('2024-09-15')).toBe('2024')
    expect(dateFormatterFor(['2024-09-15', '2024-09-16'])('2024-09-16')).toBe('16 September 2024')
  })

  it('keeps every frame of a dataset distinguishable', () => {
    for (const dates of [['2024-01-15', '2024-07-15', '2025-03-15'], ['2016-01-01', '2018-06-01'], ['2024-05-01', '2024-05-02']]) {
      const format = dateFormatterFor(dates)
      expect(new Set(dates.map(format)).size).toBe(dates.length)
    }
  })
})
