// Echo's colour and jet trail for the open data set (docs/tickets/JB04-dataset-mascot-theme.md). Pure: the manifest chooses, and this only
// fills in what it leaves out. Nothing here names a data set: an accent comes from the manifest or its colour scale, a trail is a style.

import type { ColorScale, MascotTrail, RGB, Visualization } from '../../data'

/** Echo's visor (F58, `--mascot-visor` in src/components/Mascot.tsx). The accent must stand out against it. */
export const VISOR_RGB: RGB = [0x0f, 0x22, 0x33]
/** WCAG 1.4.11: a graphic part needs 3:1 against what is next to it. */
export const MIN_ACCENT_CONTRAST = 3
/** The theme's colour, used when neither the manifest nor the colour scale gives an accent with enough contrast. */
export const FALLBACK_ACCENT = 'var(--md-sys-color-primary)'
export const DEFAULT_TRAIL: MascotTrail = 'sparks'

export type MascotTheme = { accent: string; trail: MascotTrail }

/** "#00ffcc" as [0, 255, 204]; null when it is not a colour written #rrggbb. */
export function rgbOfHex(hex: string): RGB | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null
}

export const hexOfRgb = (rgb: RGB): string => `#${rgb.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map(channel => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** HSL saturation, 0 (grey) to 1. */
export function saturation(rgb: RGB): number {
  const [max, min] = [Math.max(...rgb) / 255, Math.min(...rgb) / 255]
  if (max === min) return 0
  const lightness = (max + min) / 2
  return (max - min) / (1 - Math.abs(2 * lightness - 1))
}

/** The most saturated stop of the legend, ties going to the stop with the higher value. */
export function mostSaturatedStop(colorScale: ColorScale): RGB {
  const stops = [...colorScale.stops].sort((a, b) => a.value - b.value)
  let best = stops[0].rgb
  let bestSaturation = -1
  for (const stop of stops) {
    const s = saturation(stop.rgb)
    if (s >= bestSaturation) [best, bestSaturation] = [stop.rgb, s]
  }
  return best
}

const standsOut = (rgb: RGB) => contrastRatio(rgb, VISOR_RGB) >= MIN_ACCENT_CONTRAST

/**
 * Echo's accent and trail. The accent is the manifest's, or else the most saturated legend colour, whichever comes first with at least
 * MIN_ACCENT_CONTRAST against the visor; otherwise the theme's colour. The trail is the manifest's, or 'sparks'.
 */
export function mascotTheme(v: Pick<Visualization, 'colorScale' | 'mascot'>): MascotTheme {
  const given = v.mascot?.accent ? rgbOfHex(v.mascot.accent) : null
  const candidates = [given, mostSaturatedStop(v.colorScale)].filter((rgb): rgb is RGB => rgb !== null)
  const chosen = candidates.find(standsOut)
  return { accent: chosen ? hexOfRgb(chosen) : FALLBACK_ACCENT, trail: v.mascot?.trail ?? DEFAULT_TRAIL }
}

/** For `npm run check-data`: a warning when the manifest's own accent is too dark against the visor, so Echo will not use it. Null when it is fine or not set. */
export function accentWarning(v: Pick<Visualization, 'id' | 'mascot'>): string | null {
  const accent = v.mascot?.accent
  const rgb = accent ? rgbOfHex(accent) : null
  if (!accent || !rgb || standsOut(rgb)) return null
  const ratio = contrastRatio(rgb, VISOR_RGB).toFixed(1)
  return `public/data/${v.id}/manifest.json: mascot.accent: ${accent} has a contrast of only ${ratio}:1 against Echo's visor (${hexOfRgb(VISOR_RGB)}); it needs ${MIN_ACCENT_CONTRAST}:1, so Echo uses the colour scale's or the theme's colour instead. Pick a lighter or brighter colour.`
}
