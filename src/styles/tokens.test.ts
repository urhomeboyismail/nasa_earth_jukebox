// The Material 3 color tokens (tokens.css) and the legacy aliases built on them (index.css) must keep text
// at a contrast ratio of at least 4.5:1 (WCAG 1.4.3), and the focus ring and borders at 3:1 (WCAG 1.4.11),
// in every color scheme.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import index from '../index.css?raw'
import tokens from './tokens.css?raw'

type Rgb = [number, number, number]

const hex = (value: string): Rgb => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) as Rgb

const luminance = ([r, g, b]: Rgb) => {
  const [lr, lg, lb] = [r, g, b].map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}
const ratio = (a: Rgb, b: Rgb) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

/** The declarations inside the block that starts at `header`, up to its matching closing brace. */
function block(css: string, header: string): Record<string, string> {
  const start = css.indexOf(header)
  if (start < 0) throw new Error(`No block "${header}"`)
  let depth = 0
  let end = start
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}' && --depth === 0) { end = i; break }
  }
  return Object.fromEntries([...css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
}

// Night is :root (the default); Day is :root[data-theme='day']. High contrast adds a block for each, inside @media (prefers-contrast: more).
const NIGHT = ':root {'
const DAY = ":root[data-theme='day'] {"
const HC = '@media (prefers-contrast: more) {'
const hcBlock = (header: string) => block(tokens.slice(tokens.indexOf(HC)), header)
const night = block(tokens, NIGHT)
const day = { ...night, ...block(tokens, DAY) }
const nightHc = { ...night, ...hcBlock(NIGHT) }
const dayHc = { ...day, ...hcBlock(DAY) }
const aliases = block(index, ':root {')
const display = readFileSync('src/styles/display.css', 'utf8')
const components = readFileSync('src/styles/components.css', 'utf8')

const schemes = { night, day, 'night, high contrast': nightHc, 'day, high contrast': dayHc }

describe.each(Object.entries(schemes))('%s scheme', (_name, scheme) => {
  const all = { ...scheme, ...aliases }
  /** A token's color, following var() references and `color-mix(in srgb, var(--a), var(--b) N%)`. */
  const color = (name: string): Rgb => {
    const value = all[name]
    if (!value) throw new Error(`No token --${name}`)
    const ref = value.match(/^var\(--([\w-]+)\)$/)
    if (ref) return color(ref[1])
    const mix = value.match(/^color-mix\(in srgb, var\(--([\w-]+)\), var\(--([\w-]+)\) ([\d.]+)%\)$/)
    if (mix) {
      const [a, b, share] = [color(mix[1]), color(mix[2]), Number(mix[3]) / 100]
      return a.map((channel, i) => channel * (1 - share) + b[i] * share) as Rgb
    }
    return hex(value)
  }
  const roles = (name: string) => `md-sys-color-${name}`

  it.each([
    ['primary'], ['primary-container'], ['secondary'], ['secondary-container'], ['tertiary'], ['tertiary-container'],
    ['error'], ['error-container'], ['warning-container'], ['surface'], ['inverse-surface'],
  ])('has on-%s text that reads on it', role => {
    const on = role === 'inverse-surface' ? 'inverse-on-surface' : `on-${role}`
    // Material's inverse-on-surface is for large snackbar text only; it needs 3:1.
    expect(ratio(color(roles(on)), color(roles(role)))).toBeGreaterThanOrEqual(role === 'inverse-surface' ? 3 : 4.5)
  })

  it.each(['surface', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest'])(
    'has body, secondary, primary and error text that read on %s', surface => {
      for (const text of ['on-surface', 'on-surface-variant', 'primary', 'error']) {
        expect(ratio(color(roles(text)), color(roles(surface))), text).toBeGreaterThanOrEqual(4.5)
      }
    })

  it('has a focus ring and outline that stand out from the surface (3:1 for UI parts)', () => {
    expect(ratio(color(roles('secondary')), color(roles('surface')))).toBeGreaterThanOrEqual(3)
    expect(ratio(color(roles('outline')), color(roles('surface')))).toBeGreaterThanOrEqual(3)
  })

  /** Surface-container-high at the glass alpha over a backdrop: what the glass looks like to text drawn on it. */
  const glassOver = (backdrop: string): Rgb => {
    const alpha = parseFloat(all['glass-alpha']) / 100
    const front = color(roles('surface-container-high'))
    const back = color(roles(backdrop))
    return front.map((channel, i) => channel * alpha + back[i] * (1 - alpha)) as Rgb
  }
  // The lightest and darkest things glass can sit over: the page surface, and the two extremes of the surface ramp.
  const BACKDROPS = ['surface', 'surface-bright', 'surface-dim', 'surface-container-lowest']

  it.each(['on-surface', 'on-surface-variant', 'primary'])('keeps %s text at 4.5:1 on the glass, over every backdrop', text => {
    for (const backdrop of BACKDROPS) expect(ratio(color(roles(text)), glassOver(backdrop)), backdrop).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['ocean', 'atmosphere', 'forest', 'fire'])('has the %s accent: text on it reads (4.5:1), and as a ring or dot it stands out (3:1) from the surface and the glass', accent => {
    const fill = color(`accent-${accent}`)
    expect(ratio(color(`on-accent-${accent}`), fill)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(fill, color(roles('surface')))).toBeGreaterThanOrEqual(3)
    for (const backdrop of BACKDROPS) expect(ratio(fill, glassOver(backdrop)), backdrop).toBeGreaterThanOrEqual(3)
  })

  describe('legacy aliases', () => {
    it.each([
      ['text on the background', 'text', 'bg'],
      ['headings on the background', 'text-h', 'bg'],
      ['the accent as text on the background', 'accent', 'bg'],
      ['the error color as text on the background', 'error', 'bg'],
      ['accent text on its tinted background', 'accent', 'accent-bg'],
      ['text on a filled accent button', 'on-accent', 'accent'],
      ['text on a filled accent button on hover', 'on-accent', 'accent-strong'],
      ['heading text on the error background', 'text-h', 'error-bg'],
      ['the error label on the error background', 'error', 'error-bg'],
    ])('%s', (_label, fg, bg) => {
      expect(ratio(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5)
    })

    it('has a focus ring and button borders of 3:1 against the background', () => {
      expect(ratio(color('focus'), color('bg'))).toBeGreaterThanOrEqual(3)
      expect(ratio(color('accent-border'), color('bg'))).toBeGreaterThanOrEqual(3)
    })
  })
})

describe('tokens', () => {
  it('has the four colour blocks the generator writes: light, dark and both high-contrast ones (VIS3)', () => {
    for (const label of ['/* Night */', '/* Day */', '/* Night, high contrast */', '/* Day, high contrast */']) expect(tokens).toContain(label)
    expect(tokens).toContain('GENERATED by scripts/make_tokens.mjs')
  })

  it("defines the mascot's colours, with the accent taken from the theme (VIS3)", () => {
    for (const part of ['shell', 'shell-shade', 'visor', 'highlight', 'shadow', 'accent', 'accent-soft', 'glow', 'ocean', 'land', 'flame', 'alert', 'trail']) {
      expect(night, `--mascot-${part}`).toHaveProperty(`mascot-${part}`)
    }
    expect(night['mascot-accent']).toBe('var(--md-sys-color-primary)')
  })

  it('defines every alias in index.css from a token that exists', () => {
    for (const [name, value] of Object.entries(aliases)) {
      for (const [, ref] of value.matchAll(/var\(--([\w-]+)\)/g)) expect({ ...night, ...aliases }, `--${name}`).toHaveProperty(ref)
    }
  })

  it('has the same color roles in every scheme', () => {
    const names = (scheme: Record<string, string>) => Object.keys(scheme).filter(name => name.startsWith('md-sys-color-')).sort()
    const nightNames = names(night)
    expect(nightNames.length).toBeGreaterThan(30)
    for (const [label, scheme] of [['day', block(tokens, DAY)], ['night, high contrast', hcBlock(NIGHT)], ['day, high contrast', hcBlock(DAY)]] as const) {
      expect(names(scheme), label).toEqual(nightNames)
    }
  })

  it('has the four accents at night in the colours the overhaul asks for, and the same roles in every scheme', () => {
    expect(['ocean', 'atmosphere', 'forest', 'fire'].map(name => night[`accent-${name}`])).toEqual(['#00ffcc', '#00f0ff', '#39ff14', '#ff9f00'])
    const names = (scheme: Record<string, string>) => Object.keys(scheme).filter(name => /^(accent|on-accent|glass)-/.test(name)).sort()
    for (const scheme of [block(tokens, DAY), hcBlock(NIGHT), hcBlock(DAY)]) expect(names(scheme)).toEqual(names(night))
  })

  it('never sets type smaller than 0.75 rem in the mono roles', () => {
    const sizes = Object.entries(night).filter(([name]) => /^md-sys-typescale-.*mono-size$/.test(name))
    expect(sizes.length).toBeGreaterThanOrEqual(2)
    for (const [name, value] of sizes) expect(parseFloat(value), name).toBeGreaterThanOrEqual(0.75)
    expect(night['md-ref-typeface-mono']).toContain('JetBrains Mono')
  })

  it('tells the browser which colours it is drawing: dark for night, light for day', () => {
    expect(tokens).toMatch(/:root \{\s*color-scheme: dark;/)
    expect(tokens).toMatch(/:root\[data-theme='day'\] \{\s*color-scheme: light;/)
  })

  it('has controls of at least 44 px', () => {
    expect(parseInt(aliases['control-size'])).toBeGreaterThanOrEqual(44)
  })

  it('stops every spring when people ask for less motion', () => {
    const reduced = block(tokens, '@media (prefers-reduced-motion: reduce) {')
    const durations = Object.keys(night).filter(name => name.startsWith('md-sys-motion-') && name.endsWith('-duration'))
    expect(durations).toHaveLength(6)
    for (const name of durations) expect(reduced[name], name).toBe('0ms')
  })
})

describe('index.css', () => {
  it('no longer carries the Vite demo styles or a fixed, centered frame', () => {
    expect(index).not.toMatch(/#social|\.counter|#center|1126px|text-align: center/)
  })

  it('respects prefers-reduced-motion', () => {
    expect(index).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('loads Roboto Flex from the font file that ships with its licence (VIS3)', () => {
    const face = index.match(/@font-face\s*{[^}]*}/)?.[0] ?? ''
    expect(face).toContain("font-family: 'Roboto Flex'")
    expect(face).toContain("url('/fonts/RobotoFlex-latin.woff2') format('woff2')")
    expect(face).toContain('font-display: swap')
    for (const file of ['RobotoFlex-latin.woff2', 'OFL-RobotoFlex.txt']) expect(readFileSync(`public/fonts/${file}`).length, file).toBeGreaterThan(0)
  })
})

// VIS2: the high-contrast display scheme is yellow and cyan on black, used only on black.
describe('high-contrast display scheme (VIS2)', () => {
  const scheme = block(display, ':root.display-high-contrast {')
  const color = (name: string) => hex(scheme[`md-sys-color-${name}`])
  const black = hex('#000000')

  it('has white text on black at 4.5:1 or more (21:1)', () => {
    expect(ratio(color('on-surface'), color('surface'))).toBeGreaterThanOrEqual(21)
    expect(ratio(color('on-surface-variant'), color('surface'))).toBeGreaterThanOrEqual(4.5)
  })

  it('has the yellow focus ring and the cyan selected state at 3:1 or more on black', () => {
    expect(ratio(color('secondary'), black)).toBeGreaterThanOrEqual(3)
    expect(ratio(color('primary'), black)).toBeGreaterThanOrEqual(3)
    expect(ratio(hex('#ffe600'), black)).toBeGreaterThanOrEqual(16)
    expect(ratio(hex('#00ffff'), black)).toBeGreaterThanOrEqual(16)
  })

  it('reads on every surface and on a filled cyan button', () => {
    for (const [text, surface] of [
      ['on-surface', 'surface'], ['on-surface', 'surface-container-highest'], ['on-primary-container', 'primary-container'],
      ['on-secondary-container', 'secondary-container'], ['on-error-container', 'error-container'], ['on-primary', 'primary'],
    ]) expect(ratio(color(text), color(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5)
  })

  it('draws the borders white, 3 px or more', () => {
    expect(ratio(color('outline'), black)).toBeGreaterThanOrEqual(3)
    expect(display).toMatch(/border-width: 3px/)
  })

  it('never puts yellow or cyan on a light surface or on each other', () => {
    const lightSurfaces = ['surface', 'surface-container', 'surface-container-highest', 'inverse-surface', 'primary-container', 'secondary-container'].map(name => [name, color(name)] as const)
    for (const [name, rgb] of lightSurfaces) {
      if (name === 'inverse-surface') continue // white, used only for its own dark text
      expect(luminance(rgb), name).toBeLessThan(0.01)
    }
    expect(color('inverse-primary')).toEqual(black)
    expect(scheme['md-sys-color-on-primary-container']).not.toBe(scheme['md-sys-color-secondary-container'])
    // An accent never sits on the other accent: each accent's container is black.
    expect(color('primary-container')).toEqual(black)
    expect(color('secondary-container')).toEqual(black)
  })
})

describe('glass fallbacks (UI01)', () => {
  it('turns solid for more contrast, less transparency, no backdrop-filter, and the app high-contrast switch', () => {
    expect(components).toMatch(/@media \(prefers-contrast: more\), \(prefers-reduced-transparency: reduce\) \{\s*\.ui-glass \{ background: var\(--ui-surface-container-high\)/)
    expect(components).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{\s*\.ui-glass \{ background: var\(--ui-surface-container-high\)/)
    expect(components).toContain(':root.display-high-contrast .ui-glass { background: var(--ui-surface)')
  })

  it('keeps the glow behind the content, so it can never tint text', () => {
    expect(components).toMatch(/\.ui-glass \{[^}]*isolation: isolate/)
    expect(components).toMatch(/\.ui-glass::before \{[^}]*z-index: -1/)
  })
})
