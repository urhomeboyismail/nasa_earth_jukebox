// Where a sound sits. Stereo panning (docs/PLAN.md F13): west is the left ear, east is the right. The engine accepts a `pan`
// from -1 to 1 on playCategory and on sequence steps; callers pass these. 3D sound (F20) adds a height, `elevation`, from -1
// (south) to +1 (north), heard through an HRTF panner on headphones. Height is a place in space, never a pitch: pitch already
// means "warmer".

import { useCallback, useState } from 'react'
import type { Region } from '../data'

type ToneModule = typeof import('tone')

const clamp = (value: number) => Math.min(1, Math.max(-1, value))

/** Where a point sits across the image: x = 0 (west edge) gives -1, x = 1 (east edge) gives +1. */
export function panForPoint(x: number): number {
  if (!Number.isFinite(x)) return 0
  return clamp(x * 2 - 1)
}

/** The pan for a region: the middle of its sample points across the image. An empty region gives 0 (centre). */
export function panFor(region: Pick<Region, 'points'>): number {
  const { points } = region
  if (!points.length) return 0
  const xs = points.map(point => point.x)
  return panForPoint((Math.min(...xs) + Math.max(...xs)) / 2)
}

/** The height of a point down the image: y = 0 (north edge) gives +1, y = 1 (south edge) gives -1. */
export function elevationForPoint(y: number): number {
  if (!Number.isFinite(y)) return 0
  return clamp(1 - y * 2)
}

/** Where a point sits: `azimuth` from -1 (west) to +1 (east), the same number as the stereo pan, and `elevation` from -1 (south) to +1 (north). */
export function placeFor(x: number, y: number): { azimuth: number; elevation: number } {
  return { azimuth: panForPoint(x), elevation: elevationForPoint(y) }
}

/** The height for a region: the middle of its sample points down the image. An empty region gives 0. */
export function elevationFor(region: Pick<Region, 'points'>): number {
  const { points } = region
  if (!points.length) return 0
  const ys = points.map(point => point.y)
  return elevationForPoint((Math.min(...ys) + Math.max(...ys)) / 2)
}

export type SpatialMode = 'stereo' | '3d'

const KEY = 'earth-jukebox:spatial-mode'

/** The remembered mode, or 'stereo'. Storage can be blocked (private windows), so every access is guarded. */
export function readSpatialMode(): SpatialMode {
  try {
    return localStorage.getItem(KEY) === '3d' ? '3d' : 'stereo'
  } catch {
    return 'stereo'
  }
}

export function useSpatialMode(): [SpatialMode, (mode: SpatialMode) => void] {
  const [mode, setMode] = useState<SpatialMode>(readSpatialMode)
  const choose = useCallback((next: SpatialMode) => {
    setMode(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Not remembered, but the choice still holds for this visit.
    }
  }, [])
  return [mode, choose]
}

export type Panner = InstanceType<ToneModule['Panner']> | InstanceType<ToneModule['Panner3D']>

/** A `StereoPannerNode` for 'stereo', and for '3d' an HRTF `PannerNode` one unit from the listener, so only the direction changes, never the loudness. */
export function createPanner(t: ToneModule, mode: SpatialMode): Panner {
  if (mode === 'stereo') return new t.Panner(0)
  return new t.Panner3D({ panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1, rolloffFactor: 0, positionX: 0, positionY: 0, positionZ: -1 })
}

/** Points a panner at a place: now, or at an audio-clock `time`. Stereo ignores `elevation`. */
export function aimPanner(panner: Panner, pan: number, elevation: number, time?: number) {
  if ('pan' in panner) {
    if (time === undefined) panner.pan.value = clamp(pan)
    else panner.pan.setValueAtTime(clamp(pan), time)
    return
  }
  // The listener faces -z. Azimuth turns up to 90 degrees to either side and elevation up to 45 degrees up or down, on a sphere of radius 1.
  const theta = clamp(pan) * (Math.PI / 2)
  const phi = clamp(elevation) * (Math.PI / 4)
  const [x, y, z] = [Math.cos(phi) * Math.sin(theta), Math.sin(phi), -Math.cos(phi) * Math.cos(theta)]
  if (time === undefined) {
    panner.positionX.value = x
    panner.positionY.value = y
    panner.positionZ.value = z
  } else {
    panner.positionX.setValueAtTime(x, time)
    panner.positionY.setValueAtTime(y, time)
    panner.positionZ.setValueAtTime(z, time)
  }
}
