// Generates src/styles/tokens.css: the Material 3 Expressive tokens (T116, brought in line with the file by VIS3).
//
// Run it only to change the seed or a value below. It is NOT part of the build, and the package it needs is not in package.json:
// install it in a scratch folder and point MCU_DIR at that folder. Needs Node 22.15 or later (module.registerHooks).
//
//   mkdir /tmp/mcu && cd /tmp/mcu && npm init -y && npm i @material/material-color-utilities@0.4.0
//   MCU_DIR=/tmp/mcu node scripts/make_tokens.mjs        # writes src/styles/tokens.css and prints the contrast ratios
//   git diff --exit-code src/styles/tokens.css           # empty when nothing below changed
//
// Colour is computed from SEED: SchemeVibrant's primary, secondary, tertiary and error palettes, with a neutral palette of chroma 0,
// in the 2025 colour spec, light and dark, at contrast 0 and 1. Everything else (type, shape, elevation, motion, state, the warning
// pair and the mascot) is the data in this file, written out as it is.

import { createRequire, registerHooks } from 'node:module'
import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const dir = process.env.MCU_DIR
if (!dir) throw new Error('Set MCU_DIR to the folder where @material/material-color-utilities is installed (see the top of this file).')
// 0.4.0 has relative imports without ".js" (for example "./dynamic_color"), which Node's ESM loader refuses. Retry those with it.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context)
    } catch (error) {
      if (error?.code === 'ERR_MODULE_NOT_FOUND' && /^\.\.?\//.test(specifier) && !specifier.endsWith('.js')) return next(`${specifier}.js`, context)
      throw error
    }
  },
})
const mcu = await import(pathToFileURL(createRequire(`${dir}/`).resolve('@material/material-color-utilities')).href)
const { argbFromHex, DynamicScheme, hexFromArgb, Hct, SchemeVibrant, TonalPalette, Variant } = mcu

/** Purple. Change it and run the script to re-theme the whole app. */
const SEED = '#8a1fe0'
const SPEC = '2025'

// ---- Colour ---------------------------------------------------------------------------------------------------------------------
/** The colour roles, in the order the file lists them. Each is a getter on DynamicScheme (the role name in camelCase). */
const ROLES = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container', 'inverse-primary',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'surface', 'on-surface', 'surface-variant', 'on-surface-variant', 'surface-dim', 'surface-bright',
  'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest',
  'inverse-surface', 'inverse-on-surface', 'outline', 'outline-variant', 'shadow', 'scrim', 'background', 'on-background',
]

/** Material has no warning role: a fixed amber pair (tone 90 and tone 10 of a custom colour), swapped in dark mode. */
const WARNING = {
  light: { 'warning-container': '#ffddb3', 'on-warning-container': '#2a1800' },
  dark: { 'warning-container': '#624000', 'on-warning-container': '#ffddb3' },
}

const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

function colours(isDark, contrastLevel) {
  const sourceColorHct = Hct.fromInt(argbFromHex(SEED))
  const vibrant = new SchemeVibrant(sourceColorHct, isDark, contrastLevel, SPEC)
  // Grey surfaces and outlines: black or white backgrounds with no tint.
  const neutral = TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0)
  const scheme = new DynamicScheme({
    sourceColorHct, variant: Variant.VIBRANT, contrastLevel, isDark, specVersion: SPEC,
    primaryPalette: vibrant.primaryPalette, secondaryPalette: vibrant.secondaryPalette,
    tertiaryPalette: vibrant.tertiaryPalette, errorPalette: vibrant.errorPalette,
    neutralPalette: neutral, neutralVariantPalette: neutral,
  })
  const roles = Object.fromEntries(ROLES.map(name => [name, hexFromArgb(scheme[camel(name)]).toLowerCase()]))
  return { ...roles, ...WARNING[isDark ? 'dark' : 'light'] }
}

const SCHEMES = {
  light: colours(false, 0),
  dark: colours(true, 0),
  lightHc: colours(false, 1),
  darkHc: colours(true, 1),
}

/** The warning pair goes after the error roles. */
const ORDER = [...ROLES.slice(0, ROLES.indexOf('on-error-container') + 1), ...Object.keys(WARNING.light), ...ROLES.slice(ROLES.indexOf('surface'))]
const colourLines = (scheme, indent) => ORDER.map(name => `${indent}--md-sys-color-${name}: ${scheme[name]};`).join('\n')

// ---- Type -----------------------------------------------------------------------------------------------------------------------
const TYPEFACES = [
  `--md-ref-typeface-brand: 'Google Sans Flex', 'Google Sans', 'Roboto Flex', system-ui, 'Segoe UI Variable', 'Segoe UI', Roboto, sans-serif;`,
  `--md-ref-typeface-plain: 'Google Sans Flex', 'Roboto Flex', system-ui, 'Segoe UI Variable', 'Segoe UI', Roboto, sans-serif;`,
  `--md-sys-typescale-emphasized-weight: 650;`,
]
/** [role, size, font size, line height, weight, tracking], one group per role. */
const TYPE = [
  [['display', 'large', '3.5625rem', '4rem', 400, '-0.016rem'], ['display', 'medium', '2.8125rem', '3.25rem', 400, '0'], ['display', 'small', '2.25rem', '2.75rem', 400, '0']],
  [['headline', 'large', '2rem', '2.5rem', 400, '0'], ['headline', 'medium', '1.75rem', '2.25rem', 400, '0'], ['headline', 'small', '1.5rem', '2rem', 400, '0']],
  [['title', 'large', '1.375rem', '1.75rem', 400, '0'], ['title', 'medium', '1rem', '1.5rem', 500, '0.009rem'], ['title', 'small', '0.875rem', '1.25rem', 500, '0.006rem']],
  [['body', 'large', '1rem', '1.5rem', 400, '0.031rem'], ['body', 'medium', '0.875rem', '1.25rem', 400, '0.016rem'], ['body', 'small', '0.75rem', '1rem', 400, '0.025rem']],
  [['label', 'large', '0.875rem', '1.25rem', 500, '0.006rem'], ['label', 'medium', '0.75rem', '1rem', 500, '0.031rem'], ['label', 'small', '0.6875rem', '1rem', 500, '0.031rem']],
]
const typeLines = TYPE.map(group => group.flatMap(([role, size, font, line, weight, tracking]) => {
  const name = `--md-sys-typescale-${role}-${size}`
  return [`  ${name}-size: ${font};`, `  ${name}-line-height: ${line};`, `  ${name}-weight: ${weight};`, `  ${name}-tracking: ${tracking};`]
}).join('\n')).join('\n\n')

// ---- Shape, elevation, motion, state ---------------------------------------------------------------------------------------------
const SHAPE = {
  none: '0', 'extra-small': '4px', small: '8px', medium: '12px', large: '16px', 'large-increased': '20px',
  'extra-large': '28px', 'extra-large-increased': '32px', 'extra-extra-large': '48px', full: '9999px',
}
const ELEVATION = [
  'none',
  '0 1px 2px rgb(0 0 0 / 0.3), 0 1px 3px 1px rgb(0 0 0 / 0.15)',
  '0 1px 2px rgb(0 0 0 / 0.3), 0 2px 6px 2px rgb(0 0 0 / 0.15)',
  '0 1px 3px rgb(0 0 0 / 0.3), 0 4px 8px 3px rgb(0 0 0 / 0.15)',
  '0 2px 3px rgb(0 0 0 / 0.3), 0 6px 10px 4px rgb(0 0 0 / 0.15)',
  '0 4px 4px rgb(0 0 0 / 0.3), 0 8px 12px 6px rgb(0 0 0 / 0.15)',
]
/**
 * The springs, sampled at 25 points into linear() easings when T116 was built, with the time each takes to settle. Kept as data:
 * recomputing them from the stiffness and damping in the comment below gives easings up to 0.01 away and other durations, which
 * would change the app's motion.
 */
const SPRINGS = {
  'fast-spatial': ['0, 0.083, 0.267, 0.484, 0.688, 0.854, 0.974, 1.049, 1.085, 1.093, 1.084, 1.067, 1.046, 1.027, 1.012, 1.002, 0.995, 0.992, 0.991, 0.992, 0.994, 0.996, 0.998, 0.999, 1', '370ms'],
  'default-spatial': ['0, 0.047, 0.16, 0.296, 0.435, 0.568, 0.681, 0.776, 0.849, 0.905, 0.947, 0.975, 0.994, 1.005, 1.011, 1.014, 1.014, 1.013, 1.012, 1.01, 1.007, 1.006, 1.004, 1.003, 1', '410ms'],
  'slow-spatial': ['0, 0.047, 0.156, 0.295, 0.435, 0.565, 0.678, 0.772, 0.848, 0.904, 0.945, 0.974, 0.993, 1.005, 1.011, 1.014, 1.015, 1.014, 1.012, 1.01, 1.008, 1.006, 1.004, 1.003, 1', '570ms'],
  'fast-effects': ['0, 0.067, 0.201, 0.348, 0.485, 0.602, 0.697, 0.773, 0.831, 0.875, 0.909, 0.933, 0.95, 0.964, 0.974, 0.981, 0.986, 0.99, 0.993, 0.995, 0.996, 0.997, 0.998, 0.999, 1', '160ms'],
  'default-effects': ['0, 0.06, 0.175, 0.315, 0.448, 0.565, 0.659, 0.739, 0.802, 0.852, 0.887, 0.916, 0.938, 0.955, 0.967, 0.975, 0.982, 0.987, 0.99, 0.993, 0.995, 0.996, 0.997, 0.998, 1', '230ms'],
  'slow-effects': ['0, 0.052, 0.162, 0.296, 0.422, 0.535, 0.632, 0.715, 0.78, 0.831, 0.871, 0.903, 0.927, 0.945, 0.959, 0.97, 0.977, 0.983, 0.987, 0.991, 0.993, 0.995, 0.996, 0.997, 1', '300ms'],
}
const STATE = { hover: '0.08', focus: '0.1', pressed: '0.1', dragged: '0.16' }

/**
 * Echo, the mascot (F58): fixed colours, the same in every scheme, except the accent, which is the theme's primary. MascotDock
 * sets the accent and trail per data set (JB04).
 */
const MASCOT = {
  shell: '#ffffff', 'shell-shade': '#dce3eb', visor: '#0f2233', highlight: '#ffffff', shadow: 'var(--md-sys-color-shadow)',
  accent: 'var(--md-sys-color-primary)', 'accent-soft': 'var(--md-sys-color-primary-container)',
  glow: '#7fe7ff', ocean: '#1f5f8a', land: '#4f9b74', flame: '#ffb347', alert: '#ff9a3c', trail: '#7fe7ff',
}

// ---- Write ----------------------------------------------------------------------------------------------------------------------
const css = `/*
 * Material 3 Expressive design tokens (T116). Names follow Material's own (md.sys.*), so the M3 docs map one to one.
 * GENERATED by scripts/make_tokens.mjs: change the script and run it again (see the top of that file), never this file by hand.
 *
 * Colors: purple on black. Seed ${SEED} (purple), ${SPEC} color spec (the M3 Expressive spec), generated with
 * @material/material-color-utilities 0.4.0: a DynamicScheme with SchemeVibrant's primary, secondary, tertiary and error
 * palettes, and a neutral grey palette (chroma 0) for the surfaces and outlines, so backgrounds are black or white with no
 * tint. High contrast uses contrast level 1. Material has no warning role, so the warning pair is a fixed amber.
 * src/styles/tokens.test.ts checks the contrast of all four blocks.
 */

:root {
  /* Light */
${colourLines(SCHEMES.light, '  ')}

  /* Type. Body text uses body-large (16 px); body-medium and smaller are for captions only. */
${TYPEFACES.map(line => `  ${line}`).join('\n')}

${typeLines}

  /* Shape: the M3 Expressive corner scale. */
${Object.entries(SHAPE).map(([name, value]) => `  --md-sys-shape-corner-${name}: ${value};`).join('\n')}

  /* Elevation */
${ELEVATION.map((value, level) => `  --md-sys-elevation-level${level}: ${value};`).join('\n')}

  /*
   * Motion: the M3 Expressive spring scheme, as CSS linear() easings sampled from a damped spring (mass 1).
   * Spatial springs (position, size, shape) overshoot a little; effects springs (color, opacity) do not.
   * fast: stiffness 800, damping 0.6 | default: 380, 0.8 | slow: 200, 0.8 | effects: 3800 / 1600 / 800, damping 1.
   */
${Object.entries(SPRINGS).map(([name, [easing, duration]]) => `  --md-sys-motion-spring-${name}: linear(${easing});\n  --md-sys-motion-spring-${name}-duration: ${duration};`).join('\n')}

  /* State layers: an overlay of the content color at these opacities. */
${Object.entries(STATE).map(([name, value]) => `  --md-sys-state-${name}-state-layer-opacity: ${value};`).join('\n')}

  /* Echo, the mascot (F58). The same in every scheme but the accent, the primary; MascotDock recolours it per data set (JB04). */
${Object.entries(MASCOT).map(([name, value]) => `  --mascot-${name}: ${value};`).join('\n')}
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Dark */
${colourLines(SCHEMES.dark, '    ')}
  }
}

@media (prefers-contrast: more) {
  :root {
    /* Light, high contrast */
${colourLines(SCHEMES.lightHc, '    ')}
  }
}

@media (prefers-color-scheme: dark) and (prefers-contrast: more) {
  :root {
    /* Dark, high contrast */
${colourLines(SCHEMES.darkHc, '    ')}
  }
}

/* People who ask for less motion get none: every spring settles at once. */
@media (prefers-reduced-motion: reduce) {
  :root {
${Object.keys(SPRINGS).map(name => `    --md-sys-motion-spring-${name}-duration: 0ms;`).join('\n')}
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
  ['on-surface', 'surface', 4.5], ['on-surface-variant', 'surface', 4.5], ['primary', 'surface', 4.5], ['on-primary', 'primary', 4.5],
  ['on-error-container', 'error-container', 4.5], ['on-warning-container', 'warning-container', 4.5], ['outline', 'surface', 3],
]
for (const [name, scheme] of Object.entries(SCHEMES))
  for (const [fg, bg, need] of PAIRS) {
    const r = ratio(scheme[fg], scheme[bg])
    console.log(`${name.padEnd(7)} ${fg} on ${bg}: ${r.toFixed(2)}:1 ${r >= need ? 'ok' : `FAILS (needs ${need})`}`)
  }
