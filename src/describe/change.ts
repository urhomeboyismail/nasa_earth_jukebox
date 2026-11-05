// Words for the change from a baseline and for a contour line (docs/PLAN.md §5.8, ticket T115). Rules only, from the same `Score` the
// sound uses. Two rules about words:
//  - A single reference date is always "change since <date>". "Anomaly" is said only when the data set really is an anomaly
//    product or a climatology; nothing else is ever called an anomaly.
//  - Places are compass sectors of the map, never sea or country names: the rules do not know them.

import type { ChangeVisualization, Contour, Score } from '../analysis'
import { dateFormatterFor } from '../dates'
import type { DescribeOptions } from '.'

const MINUS = '−'

/** "+0.8 °C", "−1.2 °C", "+12%": a sign always, one decimal below 10, none from 10 up. A change of nothing has no sign. */
export function signedValue(value: number, unit: string): string {
  const size = Math.abs(value)
  const rounded = size >= 10 ? Math.round(size) : Math.round(size * 10) / 10
  const sign = rounded === 0 ? '' : value < 0 ? MINUS : '+'
  return `${sign}${rounded}${unit === '%' ? '' : ' '}${unit}`
}

/** "much-above" → "much above": the step's id read as words. */
const stepWords = (id: string) => id.replace(/[-_]+/g, ' ').trim().toLowerCase()

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** What the change is measured against, in words that fit the kind of baseline. */
function basisOf(visualization: ChangeVisualization): { lead: (value: string) => string; against: string } | null {
  const { baseline } = visualization
  if (!baseline) return null
  if (baseline.kind === 'reference-date') {
    const reference = visualization.frames.find(frame => frame.id === baseline.frameId)
    const date = reference ? dateFormatterFor(visualization.frames.map(f => f.date))(reference.date) : baseline.label
    return { lead: value => `Change since ${date}: ${value}`, against: `since ${date}` }
  }
  if (baseline.kind === 'climatology') return { lead: value => `${value} compared with ${baseline.label}`, against: `compared with ${baseline.label}` }
  // anomaly-product: the picture already is the difference from normal, and "anomaly" is the right word for it.
  return { lead: value => `${value} anomaly`, against: 'as an anomaly' }
}

/**
 * How far the whole map is from its baseline: "Above normal: +0.8 °C compared with the 1991 to 2020 August average."
 * A single reference date reads "Change since March 2020: +0.8 °C (above)." Concise leaves out the share of the map.
 */
export function describeChange(visualization: ChangeVisualization, score: Score, options: DescribeOptions = {}): string {
  const basis = basisOf(visualization)
  if (!basis) return 'This data set has no baseline, so there is no change to describe.'
  const { change } = score
  if (change.step === 'insufficient' || change.medianChange === undefined) {
    const read = Math.round(change.validFraction * 100)
    return options.detail === 'concise' ? 'Change: not enough data.' : `Change ${basis.against}: not enough data. Only ${read}% of the map could be read (land, cloud or labels), so there is no change to report.`
  }
  const unit = visualization.variable.unit
  const value = signedValue(change.medianChange, unit)
  const step = stepWords(change.step)
  const sentence = visualization.baseline?.kind === 'reference-date'
    ? `${basis.lead(value)} (${step}).`
    : `${upperFirst(step)}: ${basis.lead(value)}.`
  if (options.detail === 'concise') return sentence

  // The share at the highest level that still covers a tenth of the map, so the sentence says something a listener can picture.
  const levels = visualization.mapping.contourLevels ?? []
  let covered = -1
  levels.forEach((_, i) => { if ((change.shareAbove[i] ?? 0) >= 0.1) covered = i })
  if (covered < 0) return sentence
  const share = Math.round((change.shareAbove[covered] ?? 0) * 10) * 10
  return `${sentence} About ${share}% of the readable map is at least ${signedValue(levels[covered].value, unit)}.`
}

const COMPASS = [
  ['north-west', 'north', 'north-east'],
  ['west', 'centre', 'east'],
  ['south-west', 'south', 'south-east'],
]

/** The sector of the map a point (0 to 1 fractions of the image) is in. */
function sectorOf(x: number, y: number): string {
  const col = Math.min(2, Math.max(0, Math.floor(x * 3)))
  const row = Math.min(2, Math.max(0, Math.floor(y * 3)))
  return COMPASS[row][col]
}

/** How wide the line is across the map, in a few words a listener can picture. */
function widthWords(contour: Contour): string {
  const xs = contour.points.map(point => point.x)
  const width = Math.max(...xs) - Math.min(...xs)
  if (width < 0.15) return 'a small part of the map wide'
  if (width < 0.45) return 'about a third of the map wide'
  if (width < 0.6) return 'about half the map wide'
  if (width < 0.8) return 'about two thirds of the map wide'
  return 'most of the map wide'
}

/**
 * One contour line: "A +1 °C line runs from the north-west to the centre, about a third of the map wide."
 * A closed line "circles" a sector. A line that stops at a place with no data says so in the rich level.
 */
export function describeContour(visualization: ChangeVisualization, contour: Contour, options: DescribeOptions = {}): string {
  const unit = visualization.variable.unit
  const level = signedValue(contour.level, unit)
  const { points } = contour
  if (!points.length) return `There is no ${level} line.`
  const first = points[0]
  const last = points[points.length - 1]
  const from = sectorOf(first.x, first.y)
  const to = sectorOf(last.x, last.y)
  const concise = options.detail === 'concise'

  if (contour.closed) {
    const xs = points.map(p => p.x)
    const ys = points.map(p => p.y)
    const middle = sectorOf((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2)
    return concise ? `${level} line, round the ${middle}.` : `A ${level} line circles the ${middle}, ${widthWords(contour)}.`
  }
  const route = from === to ? `starts and ends in the ${from}` : `runs from the ${from} to the ${to}`
  if (concise) return `${level} line, ${from === to ? `${from}` : `${from} to ${to}`}.`
  const broken = contour.brokenEnds > 0 ? ' It stops where the map has no data.' : ''
  return `A ${level} line ${route}, ${widthWords(contour)}.${broken}`
}
