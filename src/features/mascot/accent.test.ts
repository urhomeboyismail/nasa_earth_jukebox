import { describe, expect, it } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import change from '../../../public/data/synthetic-change/manifest.json'
import globe from '../../../public/data/synthetic-globe/manifest.json'
import ocean from '../../../public/data/synthetic-ocean/manifest.json'
import type { ColorScale, RGB, Visualization } from '../../data'
import { visualizationSchema } from '../../data/schema'
import {
  accentWarning, contrastRatio, DEFAULT_TRAIL, FALLBACK_ACCENT, hexOfRgb, mascotTheme, MIN_ACCENT_CONTRAST, mostSaturatedStop, rgbOfHex, saturation, VISOR_RGB,
} from './accent'

const parse = (manifest: unknown): Visualization => visualizationSchema.parse(manifest)
const scale = (...rgbs: RGB[]): ColorScale => ({ stops: rgbs.map((rgb, i) => ({ value: i, rgb })), noData: [], maxColorDistance: 40 })

describe('the colour helpers', () => {
  it('read and write #rrggbb, and refuse anything else', () => {
    expect(rgbOfHex('#00ffcc')).toEqual([0, 255, 204])
    expect(rgbOfHex('#00FFCC')).toEqual([0, 255, 204])
    expect(rgbOfHex('#0fc')).toBeNull()
    expect(rgbOfHex('teal')).toBeNull()
    expect(hexOfRgb([0, 255, 204])).toBe('#00ffcc')
  })

  it('give the WCAG contrast ratio: 21 for black on white, 1 for a colour on itself, either way round', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5)
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5)
    expect(contrastRatio(VISOR_RGB, VISOR_RGB)).toBe(1)
  })

  it('give HSL saturation: 0 for greys, 1 for a pure colour', () => {
    expect(saturation([128, 128, 128])).toBe(0)
    expect(saturation([255, 255, 255])).toBe(0)
    expect(saturation([255, 0, 0])).toBe(1)
    expect(saturation([250, 160, 40])).toBeCloseTo(0.955, 3)
  })

  it('pick the most saturated stop, and the higher stop on a tie', () => {
    expect(mostSaturatedStop(scale([120, 120, 120], [250, 160, 40], [200, 200, 180]))).toEqual([250, 160, 40])
    expect(mostSaturatedStop(scale([0, 0, 255], [0, 255, 0], [255, 0, 0]))).toEqual([255, 0, 0])
    // The stops are read in order of value, whatever order the manifest lists them in.
    const unordered: ColorScale = { stops: [{ value: 9, rgb: [255, 0, 0] }, { value: 1, rgb: [0, 0, 255] }], noData: [], maxColorDistance: 40 }
    expect(mostSaturatedStop(unordered)).toEqual([255, 0, 0])
  })
})

describe('mascotTheme', () => {
  it("uses the manifest's accent and trail when they are given", () => {
    const v = { colorScale: scale([255, 0, 0]), mascot: { accent: '#00FFCC', trail: 'bubbles' as const } }
    expect(mascotTheme(v)).toEqual({ accent: '#00ffcc', trail: 'bubbles' })
  })

  it('without an accent, takes the most saturated legend colour; without a trail, sparks', () => {
    expect(mascotTheme({ colorScale: scale([120, 120, 120], [250, 160, 40]) })).toEqual({ accent: '#faa028', trail: DEFAULT_TRAIL })
    expect(DEFAULT_TRAIL).toBe('sparks')
  })

  it('falls back to the theme colour when the legend has nothing bright enough against the visor', () => {
    const dark = scale([30, 10, 60], [115, 5, 0])
    expect(contrastRatio([115, 5, 0], VISOR_RGB)).toBeLessThan(MIN_ACCENT_CONTRAST)
    expect(mascotTheme({ colorScale: dark })).toEqual({ accent: FALLBACK_ACCENT, trail: 'sparks' })
    expect(FALLBACK_ACCENT).toBe('var(--md-sys-color-primary)')
  })

  it("passes over a manifest accent that is too dark: the legend colour, then the theme's", () => {
    expect(mascotTheme({ colorScale: scale([250, 160, 40]), mascot: { accent: '#101010' } }).accent).toBe('#faa028')
    expect(mascotTheme({ colorScale: scale([115, 5, 0]), mascot: { accent: '#101010', trail: 'pulse' } })).toEqual({ accent: FALLBACK_ACCENT, trail: 'pulse' })
  })

  it('gives every reference data set an accent with enough contrast, from its own manifest', () => {
    const themes = Object.fromEntries([fixture, ocean, globe, change].map(m => parse(m)).map(v => [v.id, mascotTheme(v)]))
    expect(themes).toEqual({
      // Three fully saturated stops: the tie goes to the highest.
      fixture: { accent: '#ff0000', trail: 'sparks' },
      'synthetic-ocean': { accent: '#00ffcc', trail: 'bubbles' },
      'synthetic-globe': { accent: '#faa028', trail: 'sparks' },
      'synthetic-change': { accent: '#faa028', trail: 'sparks' },
    })
    for (const { accent } of Object.values(themes)) expect(contrastRatio(rgbOfHex(accent)!, VISOR_RGB)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST)
  })

  it('is the same every time for the same manifest', () => {
    const v = parse(globe)
    expect(mascotTheme(v)).toEqual(mascotTheme(v))
  })
})

describe('accentWarning', () => {
  it('says nothing when there is no accent, or it has enough contrast', () => {
    expect(accentWarning({ id: 'x' })).toBeNull()
    expect(accentWarning({ id: 'x', mascot: { trail: 'ions' } })).toBeNull()
    expect(accentWarning({ id: 'x', mascot: { accent: '#00f0ff' } })).toBeNull()
  })

  it('names the file, the field and the ratio when the accent is too dark', () => {
    expect(accentWarning({ id: 'x', mascot: { accent: '#802cc9' } })).toBe(
      "public/data/x/manifest.json: mascot.accent: #802cc9 has a contrast of only 2.4:1 against Echo's visor (#0f2233); it needs 3:1, "
        + "so Echo uses the colour scale's or the theme's colour instead. Pick a lighter or brighter colour.",
    )
  })
})
