import { afterEach, describe, expect, it, vi } from 'vitest'
import { aimPanner, createPanner, elevationFor, elevationForPoint, panFor, panForPoint, placeFor, readSpatialMode, type Panner } from './pan'

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

describe('placeFor', () => {
  it('puts the corners at the extremes: west and north is (-1, +1), east and south is (+1, -1)', () => {
    expect(placeFor(0, 0)).toEqual({ azimuth: -1, elevation: 1 })
    expect(placeFor(1, 0)).toEqual({ azimuth: 1, elevation: 1 })
    expect(placeFor(0, 1)).toEqual({ azimuth: -1, elevation: -1 })
    expect(placeFor(1, 1)).toEqual({ azimuth: 1, elevation: -1 })
  })

  it('puts the centre at (0, 0)', () => {
    expect(placeFor(0.5, 0.5)).toEqual({ azimuth: 0, elevation: 0 })
  })

  it('keeps azimuth equal to the stereo pan, so the two modes agree about west and east', () => {
    for (const x of [0, 0.2, 0.5, 0.9, 1]) expect(placeFor(x, 0.5).azimuth).toBe(panForPoint(x))
  })

  it('stays within -1 to 1 outside the image, and treats a bad value as the centre', () => {
    expect(placeFor(-4, -4)).toEqual({ azimuth: -1, elevation: 1 })
    expect(placeFor(9, 9)).toEqual({ azimuth: 1, elevation: -1 })
    expect(elevationForPoint(Number.NaN)).toBe(0)
  })
})

describe('elevationFor', () => {
  it('is the middle of the region down the image: high in the north, low in the south, 0 with no points', () => {
    expect(elevationFor({ points: [{ x: 0.5, y: 0 }, { x: 0.5, y: 0.2 }] })).toBeCloseTo(0.8)
    expect(elevationFor({ points: [{ x: 0.5, y: 0.8 }, { x: 0.5, y: 1 }] })).toBeCloseTo(-0.8)
    expect(elevationFor({ points: [] })).toBe(0)
  })

  it('puts the fixture region (centred down the image) at about the middle', async () => {
    const fixture = (await import('../../public/data/fixture/manifest.json')).default
    expect(Math.abs(elevationFor(fixture.regions[0]))).toBeLessThan(0.5)
  })
})

describe('createPanner and aimPanner', () => {
  const param = () => ({ value: 0, setValueAtTime: vi.fn() })
  const t = {
    Panner: class { pan = param() },
    Panner3D: class { options: unknown; positionX = param(); positionY = param(); positionZ = param(); constructor(o: unknown) { this.options = o } },
  } as unknown as Parameters<typeof createPanner>[0]

  it("makes a stereo panner for 'stereo' and an HRTF panner for '3d'", () => {
    expect('pan' in createPanner(t, 'stereo')).toBe(true)
    const panner = createPanner(t, '3d') as unknown as { options: { panningModel: string; rolloffFactor: number } }
    expect(panner.options.panningModel).toBe('HRTF')
    // No loudness change with direction, so the 3D mode differs only in where the sound is.
    expect(panner.options.rolloffFactor).toBe(0)
  })

  it('stereo ignores elevation', () => {
    const panner = createPanner(t, 'stereo') as unknown as { pan: { value: number } }
    aimPanner(panner as unknown as Panner, 0.5, 1)
    expect(panner.pan.value).toBe(0.5)
  })

  it('3D puts west on the left (negative x), east on the right, north above and south below, one unit away', () => {
    const at = (pan: number, elevation: number) => {
      const p = createPanner(t, '3d') as unknown as { positionX: { value: number }; positionY: { value: number }; positionZ: { value: number } }
      aimPanner(p as unknown as Panner, pan, elevation)
      return { x: p.positionX.value, y: p.positionY.value, z: p.positionZ.value }
    }
    expect(at(-1, 0).x).toBeLessThan(-0.99)
    expect(at(1, 0).x).toBeGreaterThan(0.99)
    expect(at(0, 1).y).toBeGreaterThan(0.5)
    expect(at(0, -1).y).toBeLessThan(-0.5)
    expect(at(0, 0)).toMatchObject({ x: 0, y: 0, z: -1 })
    for (const [pan, elevation] of [[-1, 1], [0.3, -0.7], [1, 0]]) {
      const { x, y, z } = at(pan, elevation)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1)
    }
  })

  it('3D with a time sets the position at that time instead of at once', () => {
    const p = createPanner(t, '3d') as unknown as { positionX: { setValueAtTime: ReturnType<typeof vi.fn> }; positionY: { setValueAtTime: ReturnType<typeof vi.fn> } }
    aimPanner(p as unknown as Panner, 1, 0, 12.5)
    expect(p.positionX.setValueAtTime).toHaveBeenCalledWith(expect.closeTo(1), 12.5)
    expect(p.positionY.setValueAtTime).toHaveBeenCalledWith(0, 12.5)
  })
})

describe('the remembered spatial mode', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

  it('is stereo until 3d is chosen and stored', () => {
    expect(readSpatialMode()).toBe('stereo')
    localStorage.setItem('earth-jukebox:spatial-mode', '3d')
    expect(readSpatialMode()).toBe('3d')
    localStorage.setItem('earth-jukebox:spatial-mode', 'junk')
    expect(readSpatialMode()).toBe('stereo')
  })

  it('is stereo when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readSpatialMode()).toBe('stereo')
  })
})

describe('swap ears (UI07)', () => {
  it('flips every pan that aimPanner applies, and leaves the centre alone', async () => {
    const { saveAudioPrefs, resetAudioPrefs } = await import('./prefs')
    const panner = { pan: { value: 0, setValueAtTime: vi.fn() } } as unknown as Panner & { pan: { value: number; setValueAtTime: ReturnType<typeof vi.fn> } }
    saveAudioPrefs({ swapEars: true })
    aimPanner(panner, panForPoint(0), 0)
    expect(panner.pan.value).toBe(1)
    aimPanner(panner, 0, 0)
    expect(panner.pan.value).toBe(0)
    aimPanner(panner, -0.5, 0, 2)
    expect(panner.pan.setValueAtTime).toHaveBeenCalledWith(0.5, 2)
    resetAudioPrefs()
    aimPanner(panner, panForPoint(0), 0)
    expect(panner.pan.value).toBe(-1)
  })
})
