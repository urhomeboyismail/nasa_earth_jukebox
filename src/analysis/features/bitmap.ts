// Turns a decoded picture (an ImageBitmap, from a video frame or a canvas) into RGBA pixels. Works in a worker (OffscreenCanvas) and on the main thread.

import type { Pixels } from '../analyze'

/** Reads the bitmap as `readPixels` reads a downloaded picture: no colour-space conversion happens here, and the caller closes the bitmap. */
export function pixelsFromBitmap(bitmap: ImageBitmap): Pixels {
  const { width, height } = bitmap
  let context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
  if (typeof OffscreenCanvas !== 'undefined') {
    context = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    context = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (!context) throw new Error('This browser cannot read image pixels.')
  context.drawImage(bitmap, 0, 0)
  return context.getImageData(0, 0, width, height)
}
