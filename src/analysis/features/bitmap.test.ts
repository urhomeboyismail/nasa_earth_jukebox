import { afterEach, describe, expect, it, vi } from 'vitest'
import { pixelsFromBitmap } from './bitmap'
import { fakeBitmap, stubOffscreenCanvas } from './testBitmap'
import { paint } from './testScenes'

afterEach(() => vi.unstubAllGlobals())

describe('pixelsFromBitmap', () => {
  it('draws the bitmap on an offscreen canvas and reads its pixels back, at the bitmap size', () => {
    const canvases = stubOffscreenCanvas()
    const pixels = paint((col, row) => (col + row) % 10)
    const bitmap = fakeBitmap(pixels)
    const read = pixelsFromBitmap(bitmap)
    expect(read).toBe(pixels)
    expect(canvases.created).toEqual([{ width: pixels.width, height: pixels.height }])
    expect(canvases.drawn).toEqual([bitmap])
  })

  it('does not close the bitmap: the caller does', () => {
    stubOffscreenCanvas()
    const bitmap = fakeBitmap(paint(() => 1))
    pixelsFromBitmap(bitmap)
    expect(bitmap.close).not.toHaveBeenCalled()
  })

  it('says so when the browser cannot read pixels', () => {
    stubOffscreenCanvas({ noContext: true })
    expect(() => pixelsFromBitmap(fakeBitmap(paint(() => 1)))).toThrow('This browser cannot read image pixels.')
  })
})
