// Decodes an image into RGBA pixels. Works in a worker (OffscreenCanvas) and on the main thread (a canvas element).

import type { Pixels } from './analyze'

export async function readPixels(url: string): Promise<Pixels> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`)
  const bitmap = await createImageBitmap(await response.blob())
  try {
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
  } finally {
    bitmap.close()
  }
}

/** Wraps a loader so the last `size` results are kept by key. A failure is dropped, so a retry can succeed. */
export function rememberLast<T>(load: (key: string) => Promise<T>, size = 2): (key: string) => Promise<T> {
  const kept = new Map<string, Promise<T>>()
  return key => {
    const found = kept.get(key)
    if (found) {
      // Most recently used goes last.
      kept.delete(key)
      kept.set(key, found)
      return found
    }
    const result = load(key)
    kept.set(key, result)
    result.catch(() => kept.delete(key))
    while (kept.size > size) kept.delete(kept.keys().next().value!)
    return result
  }
}
