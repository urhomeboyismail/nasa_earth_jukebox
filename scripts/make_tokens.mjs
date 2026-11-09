// Generates src/styles/tokens.css: the Material 3 Expressive tokens (T116).
//
// Run it once, and again only to change the seed or the spring values. It is NOT part of the build, and the package it needs is not
// in package.json: install it in a scratch folder and point MCU_DIR at that folder.
//
//   mkdir /tmp/mcu && cd /tmp/mcu && npm init -y && npm i @material/material-color-utilities@0.3.0
//   MCU_DIR=/tmp/mcu node scripts/make_tokens.mjs            # writes src/styles/tokens.css and prints the contrast ratios
//
// Colour: the Expressive scheme variant (SchemeExpressive) from one seed, light and dark.
// Motion: each spring is turned into a CSS linear() easing, so no JavaScript runs while it animates.

import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = process.env.MCU_DIR
if (!dir) throw new Error('Set MCU_DIR to the folder where @material/material-color-utilities is installed (see the top of this file).')
const mcu = await import(createRequire(`${dir}/`).resolve('@material/material-color-utilities'))
const { Hct, SchemeExpressive, MaterialDynamicColors: M, hexFromArgb } = mcu

// The Expressive scheme rotates hues, so this reddish seed gives an ocean-blue primary, a sand-coloured secondary container and a
// land-green tertiary (found by scanning hues; see the ticket). Change it and run the script to re-theme the whole app.
const SEED = '#b8424f'

// ---- Colour ---------------------------------------------------------------------------------------------------------------------
// [CSS role name, MaterialDynamicColors getter]
const ROLES = [
  ['primary', 'primary'], ['on-primary', 'onPrimary'], ['primary-container', 'primaryContainer'], ['on-primary-container', 'onPrimaryContainer'],
  ['secondary', 'secondary'], ['on-secondary', 'onSecondary'], ['secondary-container', 'secondaryContainer'], ['on-secondary-container', 'onSecondaryContainer'],
  ['tertiary', 'tertiary'], ['on-tertiary', 'onTertiary'], ['tertiary-container', 'tertiaryContainer'], ['on-tertiary-container', 'onTertiaryContainer'],
  ['error', 'error'], ['on-error', 'onError'], ['error-container', 'errorContainer'], ['on-error-container', 'onErrorContainer'],
  ['surface', 'surface'], ['on-surface', 'onSurface'], ['on-surface-variant', 'onSurfaceVariant'],
  ['surface-dim', 'surfaceDim'], ['surface-bright', 'surfaceBright'],
  ['surface-container-lowest', 'surfaceContainerLowest'], ['surface-container-low', 'surfaceContainerLow'], ['surface-container', 'surfaceContainer'],
  ['surface-container-high', 'surfaceContainerHigh'], ['surface-container-highest', 'surfaceContainerHighest'],
  ['outline', 'outline'], ['outline-variant', 'outlineVariant'],
  ['inverse-surface', 'inverseSurface'], ['inverse-on-surface', 'inverseOnSurface'], ['inverse-primary', 'inversePrimary'],
  ['scrim', 'scrim'], ['shadow', 'shadow'],
]

function palette(isDark) {
  const scheme = new SchemeExpressive(Hct.fromInt(mcu.argbFromHex(SEED)), isDark, 0)
  return Object.fromEntries(ROLES.map(([name, getter]) => [name, hexFromArgb(M[getter].getArgb(scheme)).toLowerCase()]))
}
const light = palette(false)
const dark = palette(true)
const colourLines = p => ROLES.map(([name]) => `  --md-sys-color-${name}: ${p[name]};`).join('\n')

// ---- Springs --------------------------------------------------------------------------------------------------------------------
// Compose MotionScheme.expressive. Stiffness k, damping ratio z, unit mass: w0 = sqrt(k).
const SPRINGS = {
  'fast-spatial': [800, 0.6], 'default-spatial': [380, 0.8], 'slow-spatial': [200, 0.8],
  'fast-effects': [3800, 1], 'default-effects': [1600, 1], 'slow-effects': [800, 1],
}

/** Position of a spring released from rest at 0 and heading for 1, at time t seconds. */
function spring(k, z, t) {
  const w0 = Math.sqrt(k)
  if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t)
  const wd = w0 * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t))
}

/** Seconds until the spring stays within 0.2% of its target. */
function settleTime(k, z) {
  let last = 0
  for (let t = 0; t < 5; t += 0.002) if (Math.abs(spring(k, z, t) - 1) > 0.002) last = t
  return last + 0.002
}

function springTokens(name, [k, z]) {
  const duration = Math.ceil(settleTime(k, z) * 100) / 100
  const steps = z >= 1 ? 24 : 48
  const points = []
  for (let i = 0; i <= steps; i++) points.push(+spring(k, z, (duration * i) / steps).toFixed(4))
  points[points.length - 1] = 1
  return [
    `  --md-sys-motion-spring-${name}: linear(${points.join(', ')});`,
    `  --md-sys-motion-spring-${name}-duration: ${duration}s;`,
  ].join('\n')
}

// ---- Type -----------------------------------------------------------------------------------------------------------------------
// Sizes in rem. The project overrides Material where AGENTS.md demands it: body text is never below 1rem, and neither is a
// button label or a title.
const FAMILY = 'var(--md-ref-typeface-brand)'
const TYPE = [
  // role, size, [size rem, line rem, weight, emphasised weight]
  ['display', 'large', [3.5625, 4, 400, 600]], ['display', 'medium', [2.8125, 3.25, 400, 600]], ['display', 'small', [2.25, 2.75, 400, 600]],
  ['headline', 'large', [2, 2.5, 400, 600]], ['headline', 'medium', [1.75, 2.25, 400, 600]], ['headline', 'small', [1.5, 2, 400, 600]],
  ['title', 'large', [1.375, 1.75, 400, 600]], ['title', 'medium', [1, 1.5, 500, 700]], ['title', 'small', [1, 1.5, 500, 700]],
  ['body', 'large', [1, 1.5, 400, 600]], ['body', 'medium', [1, 1.5, 400, 600]], ['body', 'small', [1, 1.5, 400, 600]],
  ['label', 'large', [1, 1.5, 500, 700]], ['label', 'medium', [0.875, 1.25, 500, 700]], ['label', 'small', [0.8125, 1.125, 500, 700]],
]
const typeLines = TYPE.flatMap(([role, size, [px, lh, w, we]]) => [
  `  --md-sys-typescale-${role}-${size}: ${w} ${px}rem/${lh}rem ${FAMILY};`,
  `  --md-sys-typescale-${role}-${size}-emphasized: ${we} ${px}rem/${lh}rem ${FAMILY};`,
]).join('\n')

// ---- Shape, elevation, state ----------------------------------------------------------------------------------------------------
const SHAPE = {
  none: '0', 'extra-small': '4px', small: '8px', medium: '12px', large: '16px', 'large-increased': '20px',
  'extra-large': '28px', 'extra-large-increased': '32px', 'extra-extra-large': '48px', full: '9999px',
}
const shapeLines = Object.entries(SHAPE).map(([k, v]) => `  --md-sys-shape-corner-${k}: ${v};`).join('\n')

const ELEVATION = [
  'none',
  '0 1px 2px {a}, 0 1px 3px 1px {b}',
  '0 1px 2px {a}, 0 2px 6px 2px {b}',
  '0 1px 3px {a}, 0 4px 8px 3px {b}',
  '0 2px 3px {a}, 0 6px 10px 4px {b}',
  '0 4px 4px {a}, 0 8px 12px 6px {b}',
]
const shade = pct => `color-mix(in srgb, var(--md-sys-color-shadow) ${pct}%, transparent)`
const elevationLines = ELEVATION.map((v, i) => `  --md-sys-elevation-level-${i}: ${v.replace('{a}', shade(30)).replace('{b}', shade(15))};`).join('\n')

// ---- Write ----------------------------------------------------------------------------------------------------------------------
const css = `/* GENERATED by scripts/make_tokens.mjs. Do not edit by hand: change the script and run it again (see the top of that file).
   Material 3 Expressive tokens (T116). Seed ${SEED}, scheme Expressive. The names are a contract with the other overhaul tickets
   (docs/archive/ui-overhaul/UI-A-material-3-expressive.md): add to them freely, never rename or remove one.
   The legacy names in index.css (--bg, --text, --accent, ...) point at these. */

/* Roboto Flex, variable weight and optical size, Latin subset, self-hosted (SIL OFL; licence beside the file). */
@font-face {
  font-family: 'Roboto Flex';
  font-style: normal;
  font-weight: 100 1000;
  font-display: swap;
  src: url('/fonts/RobotoFlex-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

:root {
  --md-ref-typeface-brand: 'Roboto Flex', Roboto, system-ui, 'Segoe UI', sans-serif;

  /* Colour roles, light */
${colourLines(light)}

  /* Shape */
${shapeLines}

  /* Type: each style is a \`font\` shorthand; the -emphasized one is heavier. */
${typeLines}

  /* Motion: springs as linear() easings, with the time each takes to settle. Spatial for anything that moves or changes size or
     shape (it may overshoot); effects for colour and opacity (it never does). */
${Object.entries(SPRINGS).map(([n, p]) => springTokens(n, p)).join('\n')}

  /* Elevation (a box-shadow per level) and the opacity of the state layer drawn over a hovered, focused or pressed control. */
${elevationLines}
  --md-sys-state-hover-opacity: 0.08;
  --md-sys-state-focus-opacity: 0.1;
  --md-sys-state-pressed-opacity: 0.1;
  --md-sys-state-dragged-opacity: 0.16;
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Colour roles, dark */
${colourLines(dark).replace(/^/gm, '  ')}
  }
}
`
const out = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url))
writeFileSync(out, css)
console.log(`wrote ${out}`)

// ---- Contrast report (paste the ratios into the PR) -----------------------------------------------------------------------------
const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const PAIRS = [
  ['on-surface', 'surface', 4.5], ['on-surface-variant', 'surface', 4.5], ['primary', 'surface', 4.5], ['on-surface', 'secondary-container', 4.5],
  ['on-primary', 'primary', 4.5], ['error', 'error-container', 4.5], ['outline', 'surface', 3], ['primary', 'secondary-container', 3],
]
for (const [name, p] of [['light', light], ['dark', dark]])
  for (const [fg, bg, need] of PAIRS) {
    const r = ratio(p[fg], p[bg])
    console.log(`${name.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)}:1 ${r >= need ? 'ok' : `FAILS (needs ${need})`}`)
  }
