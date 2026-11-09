// @vitest-environment node
// The color tokens must keep a contrast ratio of at least 4.5:1 for text (WCAG 1.4.3), in light and dark.
//
// The names the app styles itself with (--bg, --text, --accent, ...) are declared in index.css and point at Material roles
// (--md-sys-color-*) declared in tokens.css. This test follows that pointer, so it checks what a person actually sees.
//
// It also guards the contract the UI-overhaul tickets share (docs/ui-overhaul/UI-A-material-3-expressive.md): every frozen
// --md-sys-* name must exist, and every colour role must exist in BOTH the light and the dark block, because other tickets read
// them with fallbacks and would silently keep the fallback if a name went missing.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Read from disk: vitest hands back an empty string for `?raw` on a stylesheet with an @font-face.
const css = readFileSync(resolve(fileURLToPath(import.meta.url), '../../index.css'), 'utf8')
const tokensCss = readFileSync(resolve(fileURLToPath(import.meta.url), '../tokens.css'), 'utf8')

type Rgb = [number, number, number]

function hex(value: string): Rgb {
  const full = value.length === 4 ? value.replace(/./g, (c, i) => (i ? c + c : c)) : value
  return [1, 3, 5].map(i => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

const luminance = ([r, g, b]: Rgb) => {
  const [lr, lg, lb] = [r, g, b].map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}
const ratio = (a: Rgb, b: Rgb) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

const read = (block: string) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))

const DARK = '@media (prefers-color-scheme: dark)'
const lightTokens = read(tokensCss.slice(0, tokensCss.indexOf(DARK)))
const darkOnly = read(tokensCss.slice(tokensCss.indexOf(DARK)))
/** The legacy names, from the first `:root` block of index.css, each a `var(--md-sys-...)`. */
const legacy = read(css.slice(0, css.indexOf('#root')))

/** A token's value for a colour scheme, following `var(--name)` pointers. */
function value(name: string, mode: 'light' | 'dark'): string {
  const all = mode === 'dark' ? { ...lightTokens, ...darkOnly } : lightTokens
  let v = legacy[name] ?? all[name]
  for (let hops = 0; v?.startsWith('var(') && hops < 5; hops++) v = all[v.slice(6, -1)] ?? legacy[v.slice(6, -1)]
  return v
}

describe.each(['light', 'dark'] as const)('%s color tokens', mode => {
  const color = (name: string): Rgb => hex(value(name, mode))
  const bg = color('bg')

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

  it('has a focus ring that stands out from the background and from the tinted background (3:1 for UI parts)', () => {
    expect(ratio(color('focus'), bg)).toBeGreaterThanOrEqual(3)
    expect(ratio(color('focus'), color('accent-bg'))).toBeGreaterThanOrEqual(3)
  })

  it('has an outline that stands out from the background (3:1 for UI parts)', () => {
    expect(ratio(color('accent-border'), bg)).toBeGreaterThanOrEqual(3)
  })

  it('has controls of at least 44 px', () => {
    expect(parseInt(legacy['control-size'])).toBeGreaterThanOrEqual(44)
  })
})

describe('the shared token contract', () => {
  const COLOR_ROLES = [
    ...['primary', 'secondary', 'tertiary', 'error'].flatMap(r => [r, `on-${r}`, `${r}-container`, `on-${r}-container`]),
    'surface', 'on-surface', 'on-surface-variant', 'surface-dim', 'surface-bright',
    'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest',
    'outline', 'outline-variant', 'inverse-surface', 'inverse-on-surface', 'inverse-primary', 'scrim', 'shadow',
  ]
  const SIZES = ['large', 'medium', 'small']
  const FIXED = [
    ...['extra-small', 'small', 'medium', 'large', 'large-increased', 'extra-large', 'extra-large-increased', 'extra-extra-large', 'full'].map(s => `shape-corner-${s}`),
    ...['display', 'headline', 'title', 'body', 'label'].flatMap(role => SIZES.flatMap(s => [`typescale-${role}-${s}`, `typescale-${role}-${s}-emphasized`])),
    ...['fast', 'default', 'slow'].flatMap(speed => ['spatial', 'effects'].flatMap(kind => [`motion-spring-${speed}-${kind}`, `motion-spring-${speed}-${kind}-duration`])),
    ...[0, 1, 2, 3, 4, 5].map(level => `elevation-level-${level}`),
    ...['hover', 'focus', 'pressed', 'dragged'].map(s => `state-${s}-opacity`),
  ]

  it('defines every colour role in both the light and the dark block', () => {
    const missing = (tokens: Record<string, string>) => COLOR_ROLES.filter(role => !tokens[`md-sys-color-${role}`])
    expect(missing(lightTokens)).toEqual([])
    expect(missing(darkOnly)).toEqual([])
  })

  it('defines every shape, type, motion, elevation and state name', () => {
    expect(FIXED.filter(name => !lightTokens[`md-sys-${name}`])).toEqual([])
  })

  it('keeps body text and labels at a readable size (AGENTS.md: at least 16 px for body text)', () => {
    for (const size of SIZES) expect(lightTokens[`md-sys-typescale-body-${size}`]).toMatch(/ 1rem\//)
  })

  it('keeps the legacy names the pages use, each pointing at a role', () => {
    for (const name of ['text', 'text-h', 'bg', 'border', 'code-bg', 'accent', 'accent-strong', 'accent-bg', 'accent-border', 'on-accent', 'error', 'error-bg', 'focus'])
      expect(legacy[name], name).toMatch(/^var\(--md-sys-color-/)
  })
})

describe('index.css', () => {
  it('no longer carries the Vite demo styles', () => {
    expect(css).not.toMatch(/#social|\.counter|#center|1126px;\s*\n\s*max-width: 100%/)
  })

  it('has a fluid root, not a fixed width', () => {
    expect(css).toMatch(/#root\s*\{[^}]*width: 100%/)
    expect(css).not.toMatch(/#root\s*\{[^}]*\n\s*width: \d+px/)
  })

  it('respects prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
