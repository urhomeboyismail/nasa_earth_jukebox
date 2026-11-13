// One checked frame read into features on a stream of its own, outside a FrameSequenceSource: what fusion uses for deck B, whose frame is picked
// by deck A's date (docs/planning/UIUX-BLUEPRINT.md §3.2). Read exactly as the sequence source reads a frame.

import type { Frame, Visualization } from '../../data'
import { extractInWorker } from '../features'
import type { FrameFeatures } from '../features/types'
import { baseInput, baselineFor, defaultLoadPixels } from './input'

export async function readFrameFeatures(v: Visualization, frame: Frame, stream: string, loadPixels = defaultLoadPixels, extract = extractInWorker): Promise<FrameFeatures> {
  const [pixels, baseline] = await Promise.all([loadPixels(frame.image), baselineFor(v, frame.date, loadPixels)])
  const bitmap = await createImageBitmap(new ImageData(Uint8ClampedArray.from(pixels.data), pixels.width, pixels.height), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  return extract(stream, bitmap, { ...baseInput(v, frame.id, frame.date, 1), baseline })
}
