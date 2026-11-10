// Fakes for the picture APIs jsdom lacks (ImageBitmap, OffscreenCanvas), for the feature tests. Not shipped: only test files import this.

import { vi } from 'vitest'
import type { Pixels } from '../analyze'

/** An ImageBitmap that holds the pixels it should give back. */
export function fakeBitmap(pixels: Pixels) {
  const bitmap = { width: pixels.width, height: pixels.height, close: vi.fn(), pixels }
  // The one cast: a real ImageBitmap is made by the browser, so a test can only stand one in.
  return bitmap as unknown as ImageBitmap & { pixels: Pixels; close: ReturnType<typeof vi.fn> }
}

/** Replaces OffscreenCanvas with one whose context hands back the pixels of the bitmap drawn on it. */
export function stubOffscreenCanvas(options: { noContext?: boolean } = {}) {
  const log = { created: [] as { width: number; height: number }[], drawn: [] as unknown[] }
  class FakeOffscreenCanvas {
    private bitmap: { pixels: Pixels } | null = null
    constructor(width: number, height: number) { log.created.push({ width, height }) }
    getContext() {
      if (options.noContext) return null
      return {
        drawImage: (bitmap: { pixels: Pixels }) => { this.bitmap = bitmap; log.drawn.push(bitmap) },
        getImageData: () => this.bitmap!.pixels,
      }
    }
  }
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
  return log
}
