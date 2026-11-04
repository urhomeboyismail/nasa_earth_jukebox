// Dates for the player. Frame dates are plain YYYY-MM-DD, so they are read as UTC to stay the same in every time zone.

const long = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** "1 March 2024". Falls back to the original text if it is not a date. */
export function formatDate(iso: string): string {
  const date = parse(iso)
  return Number.isNaN(date.getTime()) ? iso : long.format(date)
}

/** "March 2024", for announcements. */
export function formatMonthYear(iso: string): string {
  const date = parse(iso)
  return Number.isNaN(date.getTime()) ? iso : monthYear.format(date)
}
