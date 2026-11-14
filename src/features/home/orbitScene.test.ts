import { describe, expect, it } from 'vitest'
import { landHeight } from './orbitScene'

describe('the moving globe', () => {
  it('has both land and sea', () => {
    const heights = Array.from({ length: 200 }, (_, i) => {
      const lat = Math.asin((i % 20) / 10 - 0.95)
      const lon = i * 0.37
      return landHeight(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))
    })
    expect(heights.some(h => h > 0.15)).toBe(true)
    expect(heights.some(h => h <= 0)).toBe(true)
  })

})
