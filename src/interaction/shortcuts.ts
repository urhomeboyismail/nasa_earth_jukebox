// Every key, touch, mouse and gamepad shortcut on Listen, in one list (docs/PLAN.md §6.3, ticket IX01; it grows out of F41's list). The keyboard matcher (useInput.ts),
// the gamepad's rows, the sound map's instructions and the "Keyboard shortcuts" dialog all read it, so what the dialog says is what the keys do.
//
// A row with `listed: false` is routed (the key makes its action) but not shown, because nothing handles it yet; the ticket that does flips it to true.

import { variableWords } from '../data'
import type { Action } from './actions'
import { GAMEPAD_BINDINGS, STICK_CELLS_PER_S } from './gamepad'
import { isDigit, isField, isLetter, isNamed, isTyping, keyName, noModifier, plainKey, spaceActivates, type KeyInput } from './keys'
import { VOICE_IDS } from '../data/sonification'

type Words = ReturnType<typeof variableWords>

/**
 * 'map': the sound map has focus. Single printable characters are always 'map' (WCAG 2.1.4), except Space.
 * 'listen': anywhere on Listen but not in a field. 'anywhere': Escape only.
 */
export type Scope = 'map' | 'listen' | 'anywhere'
export type Device = 'keyboard' | 'touch' | 'mouse' | 'gamepad'

export type ShortcutId =
  | 'play' | 'next' | 'previous' | 'trace' | 'help' | 'undo' | 'stop'
  | 'map-west' | 'map-east' | 'map-north' | 'map-south'
  | 'edge-west' | 'edge-east' | 'edge-north' | 'edge-south'
  | 'replay' | 'sweep' | 'lock'
  | 'scrub-left' | 'scrub-right' | 'scrub-home' | 'scrub-end'
  | 'query' | 'mark' | 'find' | 'follow-toggle' | 'follow-previous' | 'follow-next' | 'voice-solo' | 'voice-mute'
  | `touch-${string}` | `pad-${string}`

export type Shortcut = {
  id: ShortcutId
  /** As shown to people: 'Shift + Left arrow'. */
  keys: string
  /** What it does, in the data set's own words ("the warm edge" comes in as `words`). */
  does: (words: Words) => string
  /** When it does not work, or what else it does. */
  note?: string
  device: Device
  scope: Scope
  /** The action this key press makes, or null. Rows for touch and gamepad match nothing here: gestures.ts and gamepad.ts make their actions. */
  match: (input: KeyInput) => Action | null
  /** Where this key keeps out because the element has the key itself. */
  when?: (target: EventTarget | null) => boolean
  /** Escape must not be swallowed: a dialog closes on it. Default true. */
  prevent?: boolean
  /** Shown in the dialog and the map's instructions. Default true. */
  listed?: boolean
}

const BIG_STEP = 4
const never = () => null

/** Alt (Option on a Mac) with one named key and nothing else held. */
const isAltKey = (input: KeyInput, key: string) => input.alt && !input.ctrl && !input.meta && !input.shift && input.key === key

/** A key of the time scrub (IX06): works anywhere on Listen except in a field, and also with the sound map focused, where the plain arrows move the cursor. */
const scrub = (id: ShortcutId, label: string, key: string, action: Action, does: string): Shortcut => ({
  id, keys: `Alt + ${label}`, device: 'keyboard', scope: 'listen', does: () => does,
  when: target => !isField(target), match: input => (isAltKey(input, key) ? action : null),
})

const arrow = (key: string, id: ShortcutId, label: string, step: (big: number) => { dx: number; dy: number }): Shortcut => ({
  id, keys: label, device: 'keyboard', scope: 'map',
  does: () => `Move one place ${id.slice(4)} and play it. With Shift, move four.`,
  match: input => (isNamed(input, key) ? { type: 'move', ...step(input.shift ? BIG_STEP : 1) } : null),
})

const edge = (key: string, id: ShortcutId, label: string, action: Action, word: string): Shortcut => ({
  id, keys: label, device: 'keyboard', scope: 'map', does: () => `Go to the ${word} edge.`, match: input => (isNamed(input, key) ? action : null),
})

export const SHORTCUTS: readonly Shortcut[] = [
  // On the sound map.
  arrow('ArrowLeft', 'map-west', 'Left arrow', big => ({ dx: -big, dy: 0 })),
  arrow('ArrowRight', 'map-east', 'Right arrow', big => ({ dx: big, dy: 0 })),
  arrow('ArrowUp', 'map-north', 'Up arrow', big => ({ dx: 0, dy: -big })),
  arrow('ArrowDown', 'map-south', 'Down arrow', big => ({ dx: 0, dy: big })),
  edge('Home', 'edge-west', 'Home', { type: 'moveTo', col: 0 }, 'west'),
  edge('End', 'edge-east', 'End', { type: 'moveTo', col: Infinity }, 'east'),
  edge('PageUp', 'edge-north', 'Page Up', { type: 'moveTo', row: 0 }, 'north'),
  edge('PageDown', 'edge-south', 'Page Down', { type: 'moveTo', row: Infinity }, 'south'),
  { id: 'sweep', keys: 'Enter', device: 'keyboard', scope: 'map', does: () => 'Play the row from west to east. With Shift, play the column from north to south.', match: input => (isNamed(input, 'Enter') ? { type: 'sweep', line: input.shift ? 'column' : 'row' } : null) },
  { id: 'replay', keys: 'R', device: 'keyboard', scope: 'map', does: () => 'Play this place again.', match: input => (isLetter(input, 'r') ? { type: 'replayPlace' } : null) },
  { id: 'lock', keys: 'L', device: 'keyboard', scope: 'map', does: () => 'Lock this place, so the date slider plays it on each date. Press again to unlock.', match: input => (isLetter(input, 'l') ? { type: 'lock' } : null) },
  { id: 'trace', keys: 'T', device: 'keyboard', scope: 'map', does: words => `Trace the ${words.edge}, one line at a time.`, note: 'Only in the "Change from normal" sound.', match: input => (isLetter(input, 't') ? { type: 'trace' } : null) },
  { id: 'help', keys: '?', device: 'keyboard', scope: 'map', does: () => 'Open this list.', match: input => (noModifier(input) && input.key === '?' ? { type: 'openShortcuts' } : null) },
  // Handled by IX02 (useExplorer.ts). A second press within 4 s says where the place is.
  { id: 'query', keys: 'I', device: 'keyboard', scope: 'map', does: () => 'Ask what is here.', match: input => (isLetter(input, 'i') ? { type: 'query' } : null) },
  // Routed now, handled and listed by the tickets that own them.
  { id: 'mark', keys: 'M', device: 'keyboard', scope: 'map', does: () => 'Mark this moment.', listed: false, match: input => (isLetter(input, 'm') ? { type: 'mark' } : null) },
  { id: 'find', keys: 'F', device: 'keyboard', scope: 'map', does: () => 'Start or stop the find game.', match: input => (isLetter(input, 'f') ? { type: 'find', command: 'toggle' } : null) },
  { id: 'follow-toggle', keys: 'H', device: 'keyboard', scope: 'map', does: () => 'Follow a hot spot through time.', match: input => (isLetter(input, 'h') ? { type: 'follow', step: 'toggle' } : null) },
  { id: 'follow-previous', keys: '[', device: 'keyboard', scope: 'map', does: () => 'Follow the previous hot spot.', match: input => (noModifier(input) && input.key === '[' ? { type: 'follow', step: 'previous' } : null) },
  { id: 'follow-next', keys: ']', device: 'keyboard', scope: 'map', does: () => 'Follow the next hot spot.', match: input => (noModifier(input) && input.key === ']' ? { type: 'follow', step: 'next' } : null) },
  ...(['solo', 'mute'] as const).map((how): Shortcut => ({
    id: how === 'solo' ? 'voice-solo' : 'voice-mute', keys: how === 'solo' ? '1 to 7' : 'Shift + 1 to 7', device: 'keyboard', scope: 'map', listed: false,
    does: () => (how === 'solo' ? 'Hear only one voice.' : 'Mute one voice.'),
    match: input => {
      const at = [1, 2, 3, 4, 5, 6, 7].find(digit => isDigit(input, digit))
      return at !== undefined && input.shift === (how === 'mute') ? { type: 'voice', voice: VOICE_IDS[at - 1], how } : null
    },
  })),

  // Anywhere on Listen.
  { id: 'play', keys: 'Space', device: 'keyboard', scope: 'listen', does: () => 'Play or pause the dates.', note: 'Not while a button or a field has focus: Space presses that instead.', when: target => !spaceActivates(target), match: input => (isNamed(input, ' ') ? { type: 'transport', command: 'toggle' } : null) },
  { id: 'next', keys: 'Right arrow', device: 'keyboard', scope: 'listen', does: () => 'Go to the next date.', note: 'When the sound map does not have focus.', when: target => !isField(target), match: input => (isNamed(input, 'ArrowRight') ? { type: 'scrubTime', by: 1 } : null) },
  { id: 'previous', keys: 'Left arrow', device: 'keyboard', scope: 'listen', does: () => 'Go to the date before.', note: 'When the sound map does not have focus.', when: target => !isField(target), match: input => (isNamed(input, 'ArrowLeft') ? { type: 'scrubTime', by: -1 } : null) },
  // IX06: Alt (Option on a Mac) with Left, Right, Home or End moves through time by ear. The plain arrows above do the same when the sound map does not have focus.
  scrub('scrub-left', 'Left', 'ArrowLeft', { type: 'scrubTime', by: -1 }, 'Go to the date before and hear a short slice of it.'),
  scrub('scrub-right', 'Right', 'ArrowRight', { type: 'scrubTime', by: 1 }, 'Go to the next date and hear a short slice of it.'),
  scrub('scrub-home', 'Home', 'Home', { type: 'scrubTime', to: 'first' }, 'Go to the first date and hear a short slice of it.'),
  scrub('scrub-end', 'End', 'End', { type: 'scrubTime', to: 'last' }, 'Go to the last date and hear a short slice of it.'),
  { id: 'undo', keys: 'Ctrl + Z or Cmd + Z', device: 'keyboard', scope: 'listen', does: () => 'Undo your last move on the map, or your last lock.', when: target => !isField(target) && !isTyping(target), match: input => ((input.ctrl || input.meta) && !input.alt && !input.shift && (input.code ? input.code === 'KeyZ' : input.key.toLowerCase() === 'z') ? { type: 'undo' } : null) },
  { id: 'stop', keys: 'Escape', device: 'keyboard', scope: 'anywhere', does: () => 'Stop the sound, the trace and what this app is saying.', note: 'It cannot silence a screen reader. It no longer unlocks a locked place: press L.', prevent: false, match: input => (isNamed(input, 'Escape') ? { type: 'stopSpeech' } : null) },

  // Touch and mouse (gestures.ts makes these actions).
  { id: 'touch-tap', keys: 'Tap or drag', device: 'touch', scope: 'map', does: () => 'Play the place under your finger. Drag to hear each place.', match: never },
  { id: 'touch-two', keys: 'Two-finger tap', device: 'touch', scope: 'map', does: () => 'Stop the sound and what is being said.', match: never },
  { id: 'touch-click', keys: 'Click or drag', device: 'mouse', scope: 'map', does: () => 'Play the place under the pointer. Drag to hear each place.', match: never },

  // Gamepad (gamepad.ts makes these actions). Only the buttons something handles yet are listed.
  { id: 'pad-stick', keys: 'Left stick', device: 'gamepad', scope: 'map', does: () => `Move over the map, ${STICK_CELLS_PER_S} places a second.`, match: never },
  ...GAMEPAD_BINDINGS.map((binding): Shortcut => ({
    id: `pad-${binding.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, keys: binding.name, device: 'gamepad', scope: 'listen', does: () => binding.does, match: never,
    listed: ['move', 'scrubTime', 'transport', 'stopSpeech', 'lock', 'replayPlace', 'undo', 'query', 'follow', 'find'].includes(binding.press.type),
  })),
]

export function shortcutsFor(scope: Scope | 'all'): Shortcut[] {
  return SHORTCUTS.filter(shortcut => scope === 'all' || shortcut.scope === scope)
}

/** The shortcuts a person is told about: the ones something handles. */
export const listedShortcuts = (): Shortcut[] => SHORTCUTS.filter(shortcut => shortcut.listed !== false)

/** Which shortcut a key is, by name only (no code, no modifiers), among the keyboard rows. `'player'` means anywhere on Listen. Kept for the Symphony and Scan panels. */
export function shortcutFor(key: string, scope: 'player' | 'map'): ShortcutId | null {
  const scopes: Scope[] = scope === 'map' ? ['map'] : ['listen', 'anywhere']
  const input = plainKey(key)
  return SHORTCUTS.find(shortcut => shortcut.device === 'keyboard' && scopes.includes(shortcut.scope) && shortcut.match(input) !== null)?.id ?? null
}

export { keyName }
