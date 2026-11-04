// "15 January 2024" from a plain YYYY-MM-DD, read as UTC so it is the same in every time zone.
// (Kept here so this page does not depend on the player's files.)

const long = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? iso : long.format(date)
}
