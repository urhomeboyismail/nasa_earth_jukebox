import { describe, expect, it } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { variableWords, type Visualization } from '../../data'
import explorerSource from '../explore/useExplorer.ts?raw'
import playerSource from './index.tsx?raw'
import { keyName, SHORTCUTS, shortcutFor, type Scope } from './shortcuts'

const words = variableWords((fixture as Visualization).variable)
const SCOPES: Scope[] = ['player', 'map']

describe('the list of shortcuts', () => {
  it('gives every shortcut its own id', () => {
    const ids = SHORTCUTS.map(shortcut => shortcut.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never gives one key two meanings in the same scope', () => {
    for (const scope of SCOPES) {
      const seen = SHORTCUTS.filter(shortcut => shortcut.scope === scope).flatMap(shortcut => shortcut.keys.map(key => key.toLowerCase()))
      expect(new Set(seen).size).toBe(seen.length)
    }
  })

  it('is found again from every one of its keys', () => {
    for (const shortcut of SHORTCUTS) for (const key of shortcut.keys) expect(shortcutFor(key, shortcut.scope)).toBe(shortcut.id)
  })

  it('says what each one does, in words, with the data set\'s own words for the line of change', () => {
    for (const shortcut of SHORTCUTS) expect(shortcut.does(words).length).toBeGreaterThan(5)
    expect(SHORTCUTS.find(shortcut => shortcut.id === 'trace')?.does({ ...words, edge: 'ice edge' })).toContain('ice edge')
  })
})

describe('shortcutFor', () => {
  it('matches a letter with or without Shift or Caps Lock', () => {
    expect(shortcutFor('t', 'player')).toBe('trace')
    expect(shortcutFor('T', 'player')).toBe('trace')
    expect(shortcutFor('L', 'map')).toBe('lock')
  })

  it('keeps the two scopes apart: the same key can mean different things', () => {
    expect(shortcutFor(' ', 'player')).toBe('play')
    expect(shortcutFor(' ', 'map')).toBe('replay')
    expect(shortcutFor('Escape', 'player')).toBe('stop-trace')
    expect(shortcutFor('Escape', 'map')).toBe('stop')
    expect(shortcutFor('t', 'map')).toBeNull()
    expect(shortcutFor('Home', 'player')).toBeNull()
  })

  it('knows no other key', () => {
    for (const key of ['a', 'Tab', 'Shift', 'F1', '', '??']) for (const scope of SCOPES) expect(shortcutFor(key, scope)).toBeNull()
  })
})

describe('keyName', () => {
  it('names the keys the way a person says them', () => {
    expect(keyName(' ')).toBe('Space')
    expect(keyName('ArrowLeft')).toBe('Left arrow')
    expect(keyName('PageDown')).toBe('Page Down')
    expect(keyName('l')).toBe('L')
    expect(keyName('?')).toBe('?')
    expect(keyName('Escape')).toBe('Escape')
  })
})

describe('the keyboard handlers read the list', () => {
  // If a handler compared key names itself, a key could change without the dialog saying so. They must ask shortcutFor and name no key.
  for (const [name, source] of [['useExplorer.ts', explorerSource], ['index.tsx', playerSource]] as const) {
    it(`${name} names no key of its own`, () => {
      expect(source).toMatch(/shortcutFor\(event\.key, '(map|player)'\)/)
      expect(source).not.toMatch(/event\.key\s*[!=]==?\s*['"`]/)
      expect(source).not.toMatch(/event\.key\.toLowerCase/)
      expect(source).not.toMatch(/case\s+['"](Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown|Enter|Escape| |l|L|t|T|\?)['"]/)
    })
  }
})
