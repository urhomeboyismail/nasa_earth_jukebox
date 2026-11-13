// Whether the "change" sound style (sound pipeline v2) can be used for a data set. Its own file, with types only, so a screen can ask
// without pulling in the analysis worker.

import type { Visualization } from '../data'

/**
 * A data set has a change to hear when it has a baseline, change steps and contour levels. When this is false v2 is off everywhere and the
 * data set plays exactly as before.
 */
export function hasChange(visualization: Pick<Visualization, 'baseline' | 'mapping'>): boolean {
  const { changeSteps, contourLevels } = visualization.mapping
  return !!visualization.baseline && !!changeSteps?.length && !!contourLevels?.length
}
