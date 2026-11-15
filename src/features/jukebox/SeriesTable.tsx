// WX02: "Show the numbers" under Echo's answer. Every value Echo fetched, one row per note of the sound, with the row being heard
// marked (aria-current). Closed by default: the sound first, the words on request. The labels come from the server.

import type { Series } from './mascotQuery'

const DAY = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
const HOUR = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

/** A day, or an hour in UTC (the reply speaks in UTC too). Anything else is shown as sent. */
function timeText(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return iso.includes('T') ? `${HOUR.format(date)} UTC` : DAY.format(date)
}

type Props = {
  series: Series
  /** The row being heard, or null when nothing plays. */
  current: number | null
}

export function SeriesTable({ series, current }: Props) {
  const heading = series.unit ? `${series.metric} (${series.unit})` : series.metric
  return (
    <details className="jukebox-series">
      <summary>Show the numbers</summary>
      <table>
        <caption>
          {heading}: {series.values.length} {series.values.length === 1 ? 'value' : 'values'}, one for each note
        </caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">{heading}</th>
          </tr>
        </thead>
        <tbody>
          {series.times.map((time, index) => (
            <tr key={index} aria-current={index === current ? 'true' : undefined}>
              <th scope="row">{timeText(time)}</th>
              <td>{series.values[index].toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
