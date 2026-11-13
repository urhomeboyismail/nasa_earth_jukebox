// The hot spots of one frame as markers on the picture and as a list (docs/PLAN.md §6.3, ticket SN10). Pure: HotspotMarkers.tsx only draws what this returns.

import type { Band, FrameFeatures } from '../analysis/features/types'
import { sectorOf } from '../sonify/captions'
import { bandWord, type EventWords } from './events'

export type HotspotMarker = {
  id: string
  band: Band
  /** 0 to 1 fractions of the image. */
  x: number
  y: number
  /** "Warm area h1 in the north-east, about 4% of the map." */
  label: string
}

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const shareText = (share: number) => (share < 0.005 ? 'less than 1%' : `about ${Math.round(share * 100)}%`)

/**
 * One marker per hot spot, at its centre, in the order the extractor lists them (largest first). `words` gives the data set's own names for the bands;
 * without it a band is called "high" or "low".
 */
export function hotspotMarkers(features: FrameFeatures, words?: EventWords): HotspotMarker[] {
  return features.hotspots.map(spot => {
    const name = words ? bandWord(spot.band, words) : spot.band
    const label = `${upperFirst(name)} area ${spot.id} in the ${sectorOf(spot.centroid.x, spot.centroid.y)}, ${shareText(spot.areaShare)} of the map.`
    return { id: spot.id, band: spot.band, x: spot.centroid.x, y: spot.centroid.y, label }
  })
}
