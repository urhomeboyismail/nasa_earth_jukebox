// The color tokens in index.css must keep a contrast ratio of at least 4.5:1 for text (WCAG 1.4.3).
import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'

type Rgb = [number, number, number]

function hex(value: string): Rgb {
  const full = value.length === 4 ? value.replace(/./g, (c, i) => (i ? c + c : c)) : value
  return [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

/** `rgba(r, g, b, a)` laid over `under`. */
function over(rgba: string, under: Rgb): Rgb {
  const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number)
  return [r, g, b].map((channel, i) => channel * a + under[i] * (1 - a)) as Rgb
}

const luminance = ([r, g, b]: Rgb) => {
  const [lr, lg, lb] = [r, g, b].map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}
const ratio = (a: Rgb, b: Rgb) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

/** Tokens declared in the first `:root` block (light) or in the dark-mode media query, dark on top of light. */
function tokens(): { light: Record<string, string>; dark: Record<string, string> } {
  const read = (block: string) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
  const light = read(css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')))
  const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))
  const dark = { ...light, ...read(darkBlock.slice(0, darkBlock.indexOf('#root')) ) }
  return { light, dark }
}

describe.each(['light', 'dark'] as const)('%s color tokens', mode => {
  const t = tokens()[mode]
  const color = (name: string, under: Rgb = hex(t.bg)): Rgb => (t[name].startsWith('rgba') ? over(t[name], under) : hex(t[name]))
  const bg = hex(t.bg)

  it.each([
    ['text on the background', 'text', bg],
    ['headings on the background', 'text-h', bg],
    ['the accent as text on the background', 'accent', bg],
    ['the error color as text on the background', 'error', bg],
  ])('%s', (_label, name, under) => {
    expect(ratio(color(name), under)).toBeGreaterThanOrEqual(4.5)
  })

  it('has accent text on its tinted background', () => {
    expect(ratio(color('accent'), color('accent-bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('has text on a filled accent button, in both normal and hover color', () => {
    expect(ratio(color('on-accent'), color('accent'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(color('on-accent'), color('accent-strong'))).toBeGreaterThanOrEqual(4.5)
  })

  it('has heading text on the error background', () => {
    expect(ratio(color('text-h'), color('error-bg'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(color('error'), color('error-bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('has a focus ring that stands out from the background (3:1 for UI parts)', () => {
    expect(ratio(color('focus'), bg)).toBeGreaterThanOrEqual(3)
  })

  it('has controls of at least 44 px', () => {
    expect(parseInt(t['control-size'])).toBeGreaterThanOrEqual(44)
  })
})

describe('index.css', () => {
  it('no longer carries the Vite demo styles', () => {
    expect(css).not.toMatch(/#social|\.counter|#center|1126px;\s*\n\s*max-width: 100%/)
  })

  it('has a fluid root, not a fixed width', () => {
    expect(css).toMatch(/#root\s*\{[^}]*max-width: 1126px/)
    expect(css).not.toMatch(/#root\s*\{[^}]*\n\s*width: 1126px/)
  })

  it('respects prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
