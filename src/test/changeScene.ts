// A made-up map with a known answer, for the change tests: a seasonal level and a north-south slope that both the frame and its
// normal share, plus an optional planted patch that only the frame has. Values 0 to 10 on a blue-to-red legend; grey is land.

import type { Pixels } from '../analysis/analyze'
import type { ChangeMapping } from '../analysis/types'
import type { ColorScale } from '../data'

export const SCENE_SCALE: ColorScale = {
  stops: [{ value: 0, rgb: [0, 0, 255] }, { value: 10, rgb: [255, 0, 0] }],
  noData: [[128, 128, 128]],
  maxColorDistance: 30,
}

export const SCENE_MAPPING: ChangeMapping = {
  minValidFraction: 0.5,
  changeSteps: [
    { id: 'much-below', range: [-Infinity, -1] },
    { id: 'below', range: [-1, -0.25] },
    { id: 'normal', range: [-0.25, 0.25] },
    { id: 'above', range: [0.25, 1] },
    { id: 'much-above', range: [1, Infinity] },
  ],
  contourLevels: [{ value: 1 }, { value: 2 }],
}

export const SCENE_SIZE = { width: 360, height: 180 }

/** `landFrom`: columns from this one east are grey land. `patch`: +degrees over the western `patchShare` of the map. */
export function scene(options: { season: number; patch?: number; patchShare?: number; landFrom?: number }): Pixels {
  const { width, height } = SCENE_SIZE
  const { season, patch = 0, patchShare = 0.6, landFrom = width } = options
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (x >= landFrom) data.set([128, 128, 128, 255], i)
      else {
        const value = 1 + (y / height) * 3 + season + (x < width * patchShare ? patch : 0)
        const t = Math.min(1, Math.max(0, value / 10))
        data.set([Math.round(255 * t), 0, Math.round(255 * (1 - t)), 255], i)
      }
    }
  }
  return { data, width, height }
}
