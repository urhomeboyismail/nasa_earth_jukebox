import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { surfaceRadius, type Surface } from './orbitScene'

const surface: Surface = JSON.parse(readFileSync('public/planet/surface.json', 'utf8'))

describe("the planet's ground height", () => {
  it('stays within the height map everywhere', () => {
    const lo = Math.min(...surface.radii)
    const hi = Math.max(...surface.radii)
    for (let i = 0; i < 500; i++) {
      const y = Math.cos((i * 0.618) % Math.PI)
      const r = Math.sqrt(1 - y * y)
      const h = surfaceRadius(surface, r * Math.sin(i), y, r * Math.cos(i))
      expect(h).toBeGreaterThanOrEqual(lo - 1e-9)
      expect(h).toBeLessThanOrEqual(hi + 1e-9)
    }
  })

  it('has no step where the map wraps round', () => {
    const before = surfaceRadius(surface, -1e-6, 0, -1)
    const after = surfaceRadius(surface, 1e-6, 0, -1)
    expect(Math.abs(before - after)).toBeLessThan(1e-3)
  })
})
