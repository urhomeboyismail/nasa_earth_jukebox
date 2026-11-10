// The ruleset must give the same music for the same features, every time (docs/PLAN.md §6.3, ticket SN03): so its source may not read the clock,
// draw a random number or touch the page. (The network is guarded by src/boundary.test.ts.)

import { describe, expect, it } from 'vitest'

const sources = import.meta.glob(['./*.ts', '!./*.test.ts', '!./testFeatures.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const FORBIDDEN: [RegExp, string][] = [
  [/Math\.random\s*\(/, 'Math.random'],
  [/Date\.now\s*\(/, 'Date.now'],
  [/new\s+Date\s*\(/, 'new Date'],
  [/performance\.now\s*\(/, 'performance.now'],
  [/\b(window|document|localStorage|sessionStorage|navigator)\b/, 'a browser global'],
  [/from\s+['"]tone['"]|from\s+['"]react['"]/, 'Tone or React'],
]

describe('the ruleset is pure', () => {
  it('looks at every source file of src/sonify', () => {
    const names = Object.keys(sources).map(path => path.replace('./', ''))
    for (const expected of ['music.ts', 'presets.ts', 'detail.ts', 'captions.ts', 'ranges.ts', 'types.ts', 'index.ts']) expect(names).toContain(expected)
  })

  it('reads no clock, draws no random number, and touches no page, Tone or React', () => {
    const found = Object.entries(sources).flatMap(([file, text]) =>
      // Comments may name what they forbid.
      FORBIDDEN.filter(([pattern]) => pattern.test(text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))).map(([, what]) => `${file} uses ${what}`))
    expect(found).toEqual([])
  })
})
