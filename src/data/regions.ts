// Which region of a data set a page listens to. The first region in the manifest is the primary one; a listener may choose another (F48).

import type { Region, Visualization } from './types'

/** The first region in the manifest. The listening test, About and Ask always use it. The schema guarantees there is at least one. */
export function primaryRegion(visualization: Pick<Visualization, 'regions'>): Region {
  return visualization.regions[0]
}

/** The region with this id, or the primary region when the id is missing or the data set has no such region (a link can name anything). */
export function regionFor(visualization: Pick<Visualization, 'regions'>, id: string | null | undefined): Region {
  return visualization.regions.find(region => region.id === id) ?? primaryRegion(visualization)
}
