import { describe, expect, it } from 'vitest'
import { panFor, panForPoint } from './pan'

const region = (...xs: number[]) => ({ points: xs.map(x => ({ x, y: 0.5 })) })

describe('panForPoint', () => {
  it('is -1 at the west edge, +1 at the east edge and 0 in the centre', () => {
    expect(panForPoint(0)).toBe(-1)
    expect(panForPoint(1)).toBe(1)
    expect(panForPoint(0.5)).toBe(0)
  })

  it('moves smoothly from west to east', () => {
    expect(panForPoint(0.25)).toBe(-0.5)
    expect(panForPoint(0.75)).toBe(0.5)
  })

  it('stays within -1 to 1 for points outside the image, and treats a bad value as the centre', () => {
    expect(panForPoint(-3)).toBe(-1)
    expect(panForPoint(7)).toBe(1)
    expect(panForPoint(Number.NaN)).toBe(0)
  })
})

describe('panFor', () => {
  it('is -1 for a region on the west edge', () => {
    expect(panFor(region(0, 0))).toBe(-1)
  })

  it('is +1 for a region on the east edge', () => {
    expect(panFor(region(1, 1))).toBe(1)
  })

  it('is 0 for a region in the centre, however wide', () => {
    expect(panFor(region(0.4, 0.5, 0.6))).toBeCloseTo(0)
    expect(panFor(region(0, 1))).toBe(0)
  })

  it('is 0 for a region with no points', () => {
    expect(panFor({ points: [] })).toBe(0)
  })

  it('uses the middle of the span, not the average, so a few outlying points do not pull it', () => {
    expect(panFor(region(0.2, 0.2, 0.2, 0.6))).toBeCloseTo(-0.2)
  })

  it('puts the fixture region (points from 30% to 70% across) in the centre', async () => {
    const fixture = (await import('../../public/data/fixture/manifest.json')).default
    expect(panFor(fixture.regions[0])).toBeCloseTo(0)
  })
})
