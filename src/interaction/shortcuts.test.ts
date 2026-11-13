import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import { variableWords, type Visualization } from '../data'
import explorerSource from '../features/explore/useExplorer.ts?raw'
import playerSource from '../features/player/index.tsx?raw'
import type { Action } from './actions'
import type { KeyInput } from './keys'
import { SHORTCUTS, listedShortcuts, shortcutFor, shortcutsFor, type Scope } from './shortcuts'

const words = variableWords((fixture as Visualization).variable)
const press = (key: string, o: Partial<KeyInput> = {}): KeyInput => ({ key, code: '', shift: false, ctrl: false, meta: false, alt: false, ...o })
const keyboard = SHORTCUTS.filter(shortcut => shortcut.device === 'keyboard')
const actionFor = (input: KeyInput, scope: Scope): Action | null => {
  for (const shortcut of keyboard) {
    if (shortcut.scope !== scope) continue
    const action = shortcut.match(input)
    if (action) return action
  }
  return null
}

describe('the keyboard rows', () => {
  it('turn each key of the table into its action', () => {
    const rows: [KeyInput, Scope, Action][] = [
      [press('ArrowLeft'), 'map', { type: 'move', dx: -1, dy: 0 }],
      [press('ArrowRight'), 'map', { type: 'move', dx: 1, dy: 0 }],
      [press('ArrowUp'), 'map', { type: 'move', dx: 0, dy: -1 }],
      [press('ArrowDown'), 'map', { type: 'move', dx: 0, dy: 1 }],
      [press('ArrowRight', { shift: true }), 'map', { type: 'move', dx: 4, dy: 0 }],
      [press('ArrowUp', { shift: true }), 'map', { type: 'move', dx: 0, dy: -4 }],
      [press('Home'), 'map', { type: 'moveTo', col: 0 }],
      [press('End'), 'map', { type: 'moveTo', col: Infinity }],
      [press('PageUp'), 'map', { type: 'moveTo', row: 0 }],
      [press('PageDown'), 'map', { type: 'moveTo', row: Infinity }],
      [press('Enter'), 'map', { type: 'sweep', line: 'row' }],
      [press('Enter', { shift: true }), 'map', { type: 'sweep', line: 'column' }],
      [press('r', { code: 'KeyR' }), 'map', { type: 'replayPlace' }],
      [press('L', { code: 'KeyL', shift: true }), 'map', { type: 'lock' }],
      [press('t', { code: 'KeyT' }), 'map', { type: 'trace' }],
      [press('?', { shift: true }), 'map', { type: 'openShortcuts' }],
      [press('i', { code: 'KeyI' }), 'map', { type: 'query' }],
      [press('m', { code: 'KeyM' }), 'map', { type: 'mark' }],
      [press('f', { code: 'KeyF' }), 'map', { type: 'find', command: 'toggle' }],
      [press('h', { code: 'KeyH' }), 'map', { type: 'follow', step: 'toggle' }],
      [press('['), 'map', { type: 'follow', step: 'previous' }],
      [press(']'), 'map', { type: 'follow', step: 'next' }],
      [press('1', { code: 'Digit1' }), 'map', { type: 'voice', voice: 'melody', how: 'solo' }],
      [press('!', { code: 'Digit7', shift: true }), 'map', { type: 'voice', voice: 'time', how: 'mute' }],
      [press(' '), 'listen', { type: 'transport', command: 'toggle' }],
      [press('ArrowRight'), 'listen', { type: 'scrubTime', by: 1 }],
      [press('ArrowLeft'), 'listen', { type: 'scrubTime', by: -1 }],
      [press('z', { code: 'KeyZ', ctrl: true }), 'listen', { type: 'undo' }],
      [press('z', { code: 'KeyZ', meta: true }), 'listen', { type: 'undo' }],
      [press('Escape'), 'anywhere', { type: 'stopSpeech' }],
    ]
    for (const [input, scope, action] of rows) expect(actionFor(input, scope), `${input.key} in ${scope}`).toEqual(action)
  })

  it('matches letters by the physical key, so Shift and Caps Lock change nothing, and ignores them with Ctrl, Cmd or Alt', () => {
    expect(actionFor(press('R', { code: 'KeyR' }), 'map')).toEqual({ type: 'replayPlace' })
    expect(actionFor(press('r', { code: 'KeyR', ctrl: true }), 'map')).toBeNull()
    expect(actionFor(press('ArrowLeft', { alt: true }), 'map')).toBeNull()
    expect(actionFor(press('ArrowLeft', { alt: true }), 'listen')).toBeNull()
  })

  it('knows no other key', () => {
    for (const key of ['a', 'Tab', 'Shift', 'F1', '', '??', 'q']) {
      for (const scope of ['map', 'listen', 'anywhere'] as const) expect(actionFor(press(key), scope), key).toBeNull()
    }
  })

  it('never binds one key to two actions in the same scope', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('')
    const inputs = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Escape', '?', '[', ']']
      .flatMap(key => [press(key), press(key, { shift: true })])
      .concat(letters.flatMap(letter => [press(letter, { code: `Key${letter.toUpperCase()}` }), press(letter, { code: `Key${letter.toUpperCase()}`, ctrl: true })]))
      .concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 0].flatMap(digit => [press(String(digit), { code: `Digit${digit}` }), press('!', { code: `Digit${digit}`, shift: true })]))
    for (const scope of ['map', 'listen', 'anywhere'] as const) {
      for (const input of inputs) {
        const matches = keyboard.filter(shortcut => shortcut.scope === scope && shortcut.match(input))
        expect(matches.length, `${input.key}${input.shift ? '+Shift' : ''}${input.ctrl ? '+Ctrl' : ''} in ${scope}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('gives every row its own id', () => {
    const ids = SHORTCUTS.map(shortcut => shortcut.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('puts every single printable key in the map scope (WCAG 2.1.4), Space being the one exception', () => {
    for (const shortcut of keyboard) {
      if (shortcut.keys === 'Space') {
        expect(shortcut.scope).toBe('listen')
        expect(shortcut.note).toMatch(/Space/)
      } else if (shortcut.keys.length === 1 || /^(Shift \+ )?1 to 7$/.test(shortcut.keys)) {
        expect(shortcut.scope, shortcut.id).toBe('map')
      }
    }
  })

  it('says what each does in words, with the data set’s own words for the line of change', () => {
    for (const shortcut of SHORTCUTS) expect(shortcut.does(words).length, shortcut.id).toBeGreaterThan(5)
    expect(SHORTCUTS.find(shortcut => shortcut.id === 'trace')?.does({ ...words, edge: 'ice edge' })).toContain('ice edge')
  })

  it('leaves Space to a button, a link or a field, and the arrows to a field', () => {
    const space = SHORTCUTS.find(shortcut => shortcut.id === 'play')!
    expect(space.when?.(document.createElement('button'))).toBe(false)
    expect(space.when?.(document.createElement('div'))).toBe(true)
    const next = SHORTCUTS.find(shortcut => shortcut.id === 'next')!
    expect(next.when?.(document.createElement('input'))).toBe(false)
    expect(next.when?.(document.createElement('button'))).toBe(true)
  })

  it('keeps Escape from being swallowed, so a dialog still closes on it', () => {
    expect(SHORTCUTS.find(shortcut => shortcut.id === 'stop')?.prevent).toBe(false)
  })
})

describe('shortcutsFor and the list people are shown', () => {
  it('splits by scope and returns everything for all', () => {
    expect(shortcutsFor('all')).toHaveLength(SHORTCUTS.length)
    expect(shortcutsFor('map').every(shortcut => shortcut.scope === 'map')).toBe(true)
  })

  it('lists only what something handles: the keys of later tickets are routed but not shown', () => {
    const listed = listedShortcuts().map(shortcut => shortcut.id)
    expect(listed).toContain('replay')
    expect(listed).toContain('pad-a')
    for (const later of ['query', 'mark', 'find', 'follow-toggle', 'voice-solo', 'pad-x', 'pad-y']) expect(listed, later).not.toContain(later)
  })

  it('has a row for touch, mouse and gamepad', () => {
    expect(new Set(SHORTCUTS.map(shortcut => shortcut.device))).toEqual(new Set(['keyboard', 'touch', 'mouse', 'gamepad']))
  })
})

describe('shortcutFor (the name-only lookup the Symphony and Scan panels use)', () => {
  it('finds a key by name in a scope', () => {
    expect(shortcutFor(' ', 'player')).toBe('play')
    expect(shortcutFor('Escape', 'player')).toBe('stop')
    expect(shortcutFor('l', 'map')).toBe('lock')
    expect(shortcutFor('L', 'map')).toBe('lock')
    expect(shortcutFor('t', 'player')).toBeNull()
    expect(shortcutFor('Home', 'player')).toBeNull()
    expect(shortcutFor('a', 'map')).toBeNull()
  })
})

describe('the handlers read the list', () => {
  // If a handler compared key names itself, a key could change without the dialog saying so. They go through the input layer and name no key.
  for (const [name, source] of [['useExplorer.ts', explorerSource], ['player/index.tsx', playerSource]] as const) {
    it(`${name} names no key of its own`, () => {
      expect(source).toMatch(/useKeyboard\(/)
      expect(source).not.toMatch(/event\.key\s*[!=]==?\s*['"`]/)
      expect(source).not.toMatch(/event\.key\.toLowerCase/)
      expect(source).not.toMatch(/case\s+['"](Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown|Enter|Escape| |l|L|t|T|r|R|\?)['"]/)
    })
  }
})
