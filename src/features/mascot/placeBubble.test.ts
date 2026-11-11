import { describe, expect, it } from 'vitest'
import { BUBBLE_GAP, placeBubble } from './placeBubble'

const box = (left: number, top: number, width = 56, height = 56) => ({ left, top, width, height, right: left + width, bottom: top + height })
const size = { w: 240, h: 120 }
const viewport = { w: 1000, h: 800 }

describe('placeBubble', () => {
  it('goes above the helmet, growing to the left, when there is room', () => {
    const anchor = box(900, 700)
    expect(placeBubble(anchor, size, viewport)).toEqual({ side: 'above', x: anchor.right - size.w, y: anchor.top - BUBBLE_GAP - size.h })
  })

  it('goes below when there is no room above', () => {
    const anchor = box(900, 40)
    const place = placeBubble(anchor, size, viewport)
    expect(place.side).toBe('below')
    expect(place.y).toBe(anchor.bottom + BUBBLE_GAP)
  })

  it('goes to the left when there is no room above or below', () => {
    const short = { w: 1000, h: 140 }
    const place = placeBubble(box(900, 40), size, short)
    expect(place.side).toBe('left')
    expect(place.x).toBe(900 - BUBBLE_GAP - size.w)
  })

  it('is kept inside the viewport near the edges, a margin from each', () => {
    const east = placeBubble(box(990, 700), size, viewport)
    expect(east.x + size.w).toBeLessThanOrEqual(viewport.w - 16)
    const west = placeBubble(box(0, 700), size, viewport)
    expect(west.x).toBe(16)
  })

  it('is pinned at the margin when the viewport is smaller than the bubble', () => {
    expect(placeBubble(box(100, 100), size, { w: 200, h: 100 })).toMatchObject({ x: 16, y: 16 })
  })

  it('uses the margin it is given', () => {
    expect(placeBubble(box(0, 700), size, viewport, 40).x).toBe(40)
  })
})
