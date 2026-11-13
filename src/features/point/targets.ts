// Where Echo points (ticket IX09). Pure: a target is a hot spot's id (SN01, the date on screen) or one of nine compass places, and it resolves to a place on the
// image and a cell of the sound map. Unknown targets give null, and nothing plays. The words come from SN10's band words and compass names, so no data set is named.

import type { Hotspot } from '../../analysis/features/types'
import type { MapArea } from '../../data'
import { bandWord, type EventWords } from '../../describe/events'
import { cellOfFraction } from '../../interaction/notes'
import { sectorOf } from '../../sonify/captions'
import { COMPASS_PLACES, isCompassPlace, type CompassPlace } from './places'

export { COMPASS_PLACES, isCompassPlace, type CompassPlace }

/** A target on the date on screen: the place on the whole image (0 to 1 fractions), its cell, and the hot spot when it is one. */
export type Resolved = { x: number; y: number; cell: { col: number; row: number }; spot: Hotspot | null }

/** The middle of a compass place's third of the map, as fractions of the whole image. `centre` is the middle of the map. */
export function compassPoint(place: CompassPlace, area: MapArea): { x: number; y: number } {
  const at = COMPASS_PLACES.indexOf(place)
  const across = ((at % 3) + 0.5) / 3
  const down = (Math.floor(at / 3) + 0.5) / 3
  return { x: area.x0 + across * (area.x1 - area.x0), y: area.y0 + down * (area.y1 - area.y0) }
}

/** The place a target names on this date, or null when it names nothing there. */
export function resolveTarget(target: string, hotspots: readonly Hotspot[], area: MapArea, cols: number, rows: number): Resolved | null {
  const spot = hotspots.find(candidate => candidate.id === target) ?? null
  const point = spot ? spot.centroid : isCompassPlace(target) ? compassPoint(target, area) : null
  if (!point) return null
  return { x: point.x, y: point.y, cell: cellOfFraction(point.x, point.y, area, cols, rows), spot }
}

/** The E key's order: the date's hot spots by size, largest first (ties keep SN01's order), then the centre. */
export function offlineOrder(hotspots: readonly Hotspot[]): string[] {
  return [...[...hotspots].sort((a, b) => b.cells - a.cells).map(spot => spot.id), 'centre']
}

/** The target after `last` in the order, wrapping to the first. A `last` that is not in the order (a new date, a voice point) starts again from the first. */
export function nextOffline(order: readonly string[], last: string | null): string {
  const at = last === null ? -1 : order.indexOf(last)
  return order[(at + 1) % order.length]
}

const RANKS = ['largest', 'second-largest', 'third-largest', 'fourth-largest', 'fifth-largest', 'sixth-largest']

/**
 * The visible line for a point: "Pointing at the largest warm area, north-east." A spot is ranked among the spots of its own band, in the data set's own
 * words for that band; a compass place is named as it is ("Pointing at the centre of the map.").
 */
export function pointText(resolved: Resolved, target: string, hotspots: readonly Hotspot[], words: EventWords): string {
  const { spot } = resolved
  if (!spot) return `Pointing at the ${target} of the map.`
  const rank = hotspots.filter(other => other.band === spot.band).sort((a, b) => b.cells - a.cells).findIndex(other => other.id === spot.id)
  return `Pointing at the ${RANKS[rank] ?? 'next'} ${bandWord(spot.band, words)} area, ${sectorOf(spot.centroid.x, spot.centroid.y)}.`
}
