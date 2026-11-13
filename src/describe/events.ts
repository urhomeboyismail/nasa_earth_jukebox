// What changed between two frames of the music, in words (docs/PLAN.md §6.3, ticket SN10). Rules only, never a model: the same two frames always give the
// same events and the same sentences. The words for a band come from the data set's own category labels; no word for one data set is typed here.

import { FEATURE_COLS, type Band, type FrameFeatures, type Hotspot } from '../analysis/features/types'
import type { Visualization } from '../data'
import { legendOf, type LegendKind } from '../data/sonification'
import { sectorOf } from '../sonify/captions'

/** A hot spot has moved when its centre has shifted by more than this many grid cells (as a share of the image width). */
export const MOVE_CELLS = 2
/** A hot spot has grown or shrunk when its share of the map changed by more than this much of its earlier share. */
export const SIZE_STEP = 0.5

export type Direction = 'north' | 'south' | 'east' | 'west'

export type SoundEvent =
  | { kind: 'appeared'; id: string; band: Band; place: string }
  | { kind: 'gone'; id: string; band: Band; place: string }
  | { kind: 'moved'; id: string; band: Band; place: string; direction: Direction; cells: number }
  | { kind: 'grew' | 'shrank'; id: string; band: Band; place: string }
  | { kind: 'dropout' }
  | { kind: 'recovered' }

/** What the sentences need from a data set: its category labels, and whether it is a picture (then bands are bright and dark). */
export type EventWords = Pick<Visualization, 'mapping'> & { legend?: LegendKind }

/** The data set's own word for a band, lower case: the top category's label for `high`, the bottom one's for `low`. A picture has no measured ranges to name: bright and dark. */
export function bandWord(band: Band, words: EventWords): string {
  if (legendOf(words) === 'picture') return band === 'high' ? 'bright' : 'dark'
  const { categories } = words.mapping
  const category = band === 'high' ? categories[categories.length - 1] : categories[0]
  return category.label.toLowerCase()
}

const placeOf = (spot: Hotspot) => sectorOf(spot.centroid.x, spot.centroid.y)

const KIND_ORDER = ['appeared', 'gone', 'moved', 'grew', 'shrank']

function compare(a: Hotspot, b: Hotspot): SoundEvent[] {
  const events: SoundEvent[] = []
  const dx = b.centroid.x - a.centroid.x
  const dy = b.centroid.y - a.centroid.y
  const far = Math.max(Math.abs(dx), Math.abs(dy))
  if (far > MOVE_CELLS / FEATURE_COLS) {
    const direction: Direction = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north'
    events.push({ kind: 'moved', id: b.id, band: b.band, place: placeOf(b), direction, cells: Math.round(far * FEATURE_COLS) })
  }
  if (a.areaShare > 0) {
    const change = (b.areaShare - a.areaShare) / a.areaShare
    if (Math.abs(change) > SIZE_STEP) events.push({ kind: change > 0 ? 'grew' : 'shrank', id: b.id, band: b.band, place: placeOf(b) })
  }
  return events
}

/**
 * The events from `previous` to `next`, ordered by hot-spot id and then by kind. Pure.
 * Nothing is compared for the first frame of a run (`previous` null). A frame that cannot be read says only `dropout`, and the frame after it only
 * `recovered`: the hot spots of an unreadable frame are not trusted, so they are not announced as gone or new.
 */
export function eventsBetween(previous: FrameFeatures | null, next: FrameFeatures): SoundEvent[] {
  if (!previous) return []
  const wasReadable = previous.stats.position !== null
  const isReadable = next.stats.position !== null
  if (wasReadable && !isReadable) return [{ kind: 'dropout' }]
  if (!wasReadable && isReadable) return [{ kind: 'recovered' }]
  if (!isReadable) return []

  const before = new Map(previous.hotspots.map(spot => [spot.id, spot]))
  const after = new Map(next.hotspots.map(spot => [spot.id, spot]))
  const events: SoundEvent[] = []
  for (const [id, spot] of before) if (!after.has(id)) events.push({ kind: 'gone', id, band: spot.band, place: placeOf(spot) })
  for (const [id, spot] of after) {
    const old = before.get(id)
    if (!old) events.push({ kind: 'appeared', id, band: spot.band, place: placeOf(spot) })
    else events.push(...compare(old, spot))
  }
  const idOf = (event: SoundEvent) => ('id' in event ? event.id : '')
  return events.sort((a, b) => idOf(a).localeCompare(idOf(b), 'en', { numeric: true }) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
}

/** The sentence for one event, in the data set's own words: "A new warm area appeared in the north-east." Never states a value. */
export function describeEvent(event: SoundEvent, words: EventWords): string {
  switch (event.kind) {
    case 'appeared': return `A new ${bandWord(event.band, words)} area appeared in the ${event.place}.`
    case 'gone': return `The ${bandWord(event.band, words)} area in the ${event.place} has gone.`
    case 'moved': return `The ${bandWord(event.band, words)} area moved ${event.direction}.`
    case 'grew': return `The ${bandWord(event.band, words)} area in the ${event.place} grew.`
    case 'shrank': return `The ${bandWord(event.band, words)} area in the ${event.place} shrank.`
    case 'dropout': return 'There is not enough readable data on this date.'
    case 'recovered': return 'Readable data is back.'
  }
}
