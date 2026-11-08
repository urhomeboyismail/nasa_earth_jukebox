// Dates for every page. Frame dates are plain YYYY-MM-DD, so they are read as UTC to stay the same in every time zone.
//
// How much of a date to show depends on the dataset. Monthly frames read "January 2024", not "15 January 2024", and
// yearly frames read "2024": a day would suggest more precision than the data has.

export type DateGranularity = 'day' | 'month' | 'year'

const formats: Record<DateGranularity, Intl.DateTimeFormat> = {
  day: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  month: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  year: new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: 'UTC' }),
}

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`)
const isDate = (iso: string) => !Number.isNaN(parse(iso).getTime())

/**
 * The coarsest level that still tells every frame apart: the year if each frame is in a different year, the month if
 * each is in a different month, otherwise the day. Text that is not a date is ignored.
 */
export function granularityOf(dates: string[]): DateGranularity {
  const valid = dates.filter(isDate)
  if (valid.length < 2) return 'day'
  const allDifferent = (length: number) => new Set(valid.map(iso => iso.slice(0, length))).size === valid.length
  if (allDifferent(4)) return 'year'
  if (allDifferent(7)) return 'month'
  return 'day'
}

/** "15 January 2024", "January 2024" or "2024". Falls back to the original text if it is not a date. */
export function formatDate(iso: string, granularity: DateGranularity = 'day'): string {
  return isDate(iso) ? formats[granularity].format(parse(iso)) : iso
}

/** Writes every date of one dataset at the same level of detail. */
export function dateFormatterFor(dates: string[]): (iso: string) => string {
  const granularity = granularityOf(dates)
  return iso => formatDate(iso, granularity)
}
