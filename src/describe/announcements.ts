// The exact words the live region says (T93), as pure functions: the same input always gives the same text. They take pieces
// that are already written (a formatted date, a label, a cell description) so this file needs nothing from the data.
// Every message is at most 160 characters in rich detail and 60 in concise detail. When a missing-data date or cell is
// named, the words are T90's: "not enough data", and the hiss in place of a note.

import type { Detail } from './detail'

/** The longest message for each level of detail. */
export const MAX_ANNOUNCEMENT = { rich: 160, concise: 60 } as const
export const maxAnnouncement = (detail: Detail) => MAX_ANNOUNCEMENT[detail]

/**
 * Cuts a message that is too long at the last comma (then the last space) that fits, and says it goes on.
 * A message that fits is returned as it is.
 */
export function fitAnnouncement(text: string, detail: Detail): string {
  const max = maxAnnouncement(detail)
  if (text.length <= max) return text
  const room = max - 1
  const comma = text.lastIndexOf(', ', max - ' and more.'.length)
  if (comma > room / 2) return `${text.slice(0, comma)} and more.`
  const space = text.lastIndexOf(' ', room)
  return `${text.slice(0, space > room / 2 ? space : room).replace(/[\s,.:;]+$/, '')}…`
}

/** One date of the player. `label` is the lower-case category ("warm"); `missing` is a date with not enough data. `value` is the rounded value with its unit ("21 °C"). */
export type DateParts = { date: string; label: string; missing?: boolean; value?: string; detail: Detail }

/** "March 2024: warm, about 21 °C" (rich), "March 2024: warm" (concise); "March 2025: not enough data, so you hear the hiss" for a date without data in rich detail. No full stop, so a prefix can be added. */
function dateBody({ date, label, missing, value, detail }: DateParts): string {
  if (missing) return `${date}: not enough data${detail === 'rich' ? ', so you hear the hiss' : ''}`
  return `${date}: ${label}${detail === 'rich' && value ? `, about ${value}` : ''}`
}

/** The player's line for a date it lands on during playback, or on its own. */
export function playerDateLine(parts: DateParts): string {
  return fitAnnouncement(dateBody(parts), parts.detail)
}

export type StopKind = 'paused' | 'stopped' | 'finished'
const STOP_WORDS: Record<StopKind, string> = { paused: 'Paused at', stopped: 'Stopped at', finished: 'Finished at' }

/** What is said when playback pauses, is stopped, or reaches its end: always the current date, whatever was said before. "Paused at June 2024: hot." */
export function playerStopLine(kind: StopKind, parts: DateParts): string {
  return fitAnnouncement(`${STOP_WORDS[kind]} ${dateBody(parts)}.`, parts.detail)
}

/** True when playback should say a date: the first one, or one whose category differs from the last one said. */
export function categoryChanged(last: string | null, next: string): boolean {
  return last === null || last !== next
}

/**
 * The explorer's message for a cell. `cell` is the cell description (describeCell). With a `date` (the first message after the
 * explorer is turned on, or after the date changes) it starts with the date: "March 2024. Warm, about 21 °C, north-east, ...".
 * Later moves pass no date.
 */
export function explorerMessage(cell: string, detail: Detail, date?: string): string {
  return fitAnnouncement(date ? `${date}. ${cell}` : cell, detail)
}

export type Edge = 'West' | 'East' | 'North' | 'South'

/** A key pushed against the edge of the map: "West edge." The same at both levels of detail. */
export function edgeMessage(edge: Edge): string {
  return `${edge} edge.`
}

/** The end of a sweep: the description of the row or column (describeSweep), cut to fit when many short runs make it long. */
export function sweepEndMessage(sweep: string, detail: Detail): string {
  return fitAnnouncement(sweep, detail)
}
