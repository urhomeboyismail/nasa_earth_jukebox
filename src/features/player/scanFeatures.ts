// The features of one checked frame, for Scan (docs/PLAN.md §6.3, ticket SN08). The PNG is read exactly as the checked-frame source reads it (same
// legend, same area, plain colour tolerance), but each frame stands alone: a scan is one picture, so it has no motion and no earlier hot spots.
// The result is kept by frame, so scanning the same date again does not read the picture again.

import { baseInput, baselineFor, defaultLoadPixels } from '../../analysis/video/input'
import { extractInWorker, resetStream } from '../../analysis/features'
import type { FrameFeatures } from '../../analysis/features/types'
import type { Pixels } from '../../analysis/analyze'
import type { Frame, Visualization } from '../../data'

const STREAM = 'scan'
/** Results kept: a listener moves between a few dates. */
const KEPT = 8

export type ScanFeatureDeps = {
  extract?: typeof extractInWorker
  loadPixels?: (url: string) => Promise<Pixels>
  loadBitmap?: (pixels: Pixels) => Promise<ImageBitmap>
}

const cache = new Map<string, Promise<FrameFeatures>>()

/** Draws the pixels into a bitmap for the worker. Colours are left as they are in the file. */
function bitmapOf(pixels: Pixels): Promise<ImageBitmap> {
  return createImageBitmap(new ImageData(Uint8ClampedArray.from(pixels.data), pixels.width, pixels.height), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
}

/** Forgets every kept result (tests, and a data set that changed). */
export function clearScanFeatures(): void {
  cache.clear()
}

/** The features of a checked frame. A failure is not kept, so a retry can succeed. */
export function scanFeatures(visualization: Visualization, frame: Frame, deps: ScanFeatureDeps = {}): Promise<FrameFeatures> {
  const key = `${visualization.id}/${frame.id}`
  const kept = cache.get(key)
  if (kept) {
    // Most recently used goes last.
    cache.delete(key)
    cache.set(key, kept)
    return kept
  }
  const extract = deps.extract ?? extractInWorker
  const loadPixels = deps.loadPixels ?? defaultLoadPixels
  const loadBitmap = deps.loadBitmap ?? bitmapOf
  const result = (async () => {
    const [pixels, baseline] = await Promise.all([loadPixels(frame.image), baselineFor(visualization, frame.date, loadPixels)])
    const bitmap = await loadBitmap(pixels)
    // A scan reads one picture on its own: the stream starts fresh each time.
    resetStream(STREAM)
    return extract(STREAM, bitmap, { ...baseInput(visualization, frame.id, frame.date, 1), baseline })
  })()
  cache.set(key, result)
  result.catch(() => cache.delete(key))
  while (cache.size > KEPT) cache.delete(cache.keys().next().value!)
  return result
}
