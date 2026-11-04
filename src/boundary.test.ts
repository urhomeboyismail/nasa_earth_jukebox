// The hard boundary (docs/PLAN.md §9): agents and language models never sit in the analysis, the sound, the descriptions or
// the scoring of the listening test. The same frame must always give the same category, chord, words and score, and the
// listening experience must work with the server off. So these files may not reach the voice guide, the server or the network.

import { describe, expect, it } from 'vitest'

// The guarded source files, read as text at build time (no Node needed). Tests are left out: they may name what they forbid.
const sources = import.meta.glob(
  ['./analysis/**/*.{ts,tsx}', './audio/**/*.{ts,tsx}', './describe/**/*.{ts,tsx}', './features/compare/judge.ts', '!./**/*.test.*'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

/** The one place allowed to fetch: it downloads the picture it is about to read. */
const MAY_FETCH = ['analysis/pixels.ts']

const FORBIDDEN_IMPORT = /(^|\/)(assistant|config)(\/|$)|useVoiceAssistant|VoiceAssistant/

/** What is wrong with one file's text, as readable lines. Empty when it is clean. */
function violations(file: string, text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    if (FORBIDDEN_IMPORT.test(match[1])) found.push(`${file} imports "${match[1]}"`)
  }
  if (/\bfetch\s*\(/.test(text) && !MAY_FETCH.includes(file)) found.push(`${file} calls fetch()`)
  if (/\bWebSocket\b/.test(text)) found.push(`${file} uses WebSocket`)
  return found
}

const files = Object.entries(sources).map(([path, text]) => ({ file: path.replace(/^\.\//, ''), text }))

describe('the boundary: no voice guide, server or network in the analysis, sound, descriptions or scoring', () => {
  it('actually looks at the files it guards', () => {
    const names = files.map(entry => entry.file)
    for (const expected of ['analysis/analyze.ts', 'analysis/index.ts', 'audio/engine.ts', 'describe/index.ts', 'features/compare/judge.ts']) {
      expect(names).toContain(expected)
    }
    expect(names.some(name => name.endsWith('.test.ts') || name.endsWith('.test.tsx'))).toBe(false)
  })

  it('finds nothing wrong in any of them', () => {
    expect(files.flatMap(({ file, text }) => violations(file, text))).toEqual([])
  })
})

describe('the rules behind it', () => {
  it('flag an import of the voice guide, its hook, its component or the config', () => {
    for (const path of ['../assistant/context', '../../assistant/ducking', '../hooks/useVoiceAssistant', '../VoiceAssistant', '../config']) {
      expect(violations('audio/voicing.ts', `import { x } from '${path}'`)).toEqual([`audio/voicing.ts imports "${path}"`])
    }
  })

  it('flag a bare, a type and a dynamic import too', () => {
    expect(violations('a.ts', `import '../config'`)).toHaveLength(1)
    expect(violations('a.ts', `import type { X } from '../assistant/context'`)).toHaveLength(1)
    expect(violations('a.ts', `const m = await import('../assistant/context')`)).toHaveLength(1)
  })

  it('flag fetch() and WebSocket, except where a picture is downloaded', () => {
    expect(violations('describe/index.ts', `const r = await fetch('/api')`)).toEqual(['describe/index.ts calls fetch()'])
    expect(violations('audio/engine.ts', `new WebSocket('wss://x')`)).toEqual(['audio/engine.ts uses WebSocket'])
    expect(violations('analysis/pixels.ts', `const response = await fetch(url)`)).toEqual([])
  })

  it('leave ordinary imports alone', () => {
    expect(violations('a.ts', `import { Note } from 'tonal'\nimport type { SoundMapping } from '../data'\nimport { x } from './style'`)).toEqual([])
  })
})
