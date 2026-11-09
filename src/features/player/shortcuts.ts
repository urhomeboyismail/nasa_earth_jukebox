// F41: every key Listen answers to, in one list. The keyboard handlers (the player's and the sound map's) ask `shortcutFor` which key
// means what, and the "Keyboard shortcuts" dialog is drawn from the same list, so what the dialog says is what the keys do.

import { variableWords } from '../../data'

/** "player" keys work while focus is anywhere in the player. "map" keys work only while the sound map has focus. */
export type Scope = 'player' | 'map'

export type ShortcutId =
  | 'play' | 'next' | 'previous' | 'trace' | 'stop-trace' | 'help'
  | 'map-west' | 'map-east' | 'map-north' | 'map-south'
  | 'edge-west' | 'edge-east' | 'edge-north' | 'edge-south'
  | 'replay' | 'sweep' | 'lock' | 'stop'

type Words = ReturnType<typeof variableWords>

export type Shortcut = {
  id: ShortcutId
  scope: Scope
  /** The `KeyboardEvent.key` values that do this. A letter matches in either case. */
  keys: readonly string[]
  /** What it does. The data set's own words (its "warm edge") come in as `words`, so nothing here names a variable. */
  does: (words: Words) => string
  /** When it does not work, or what else it does. */
  note?: string
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'play', scope: 'player', keys: [' '], does: () => 'Play or pause the dates.', note: 'Not while a button or a field has focus: Space presses that instead.' },
  { id: 'next', scope: 'player', keys: ['ArrowRight'], does: () => 'Go to the next date.' },
  { id: 'previous', scope: 'player', keys: ['ArrowLeft'], does: () => 'Go to the date before.' },
  { id: 'trace', scope: 'player', keys: ['t'], does: words => `Trace the ${words.edge}, one line at a time.`, note: 'Only in the "Change from normal" sound.' },
  { id: 'stop-trace', scope: 'player', keys: ['Escape'], does: () => 'Stop the trace.', note: 'Only while it is playing.' },
  { id: 'help', scope: 'player', keys: ['?'], does: () => 'Open this list.', note: 'Not in a text box, where a question mark is just a question mark.' },

  { id: 'map-west', scope: 'map', keys: ['ArrowLeft'], does: () => 'Move one place west and play it. With Shift, move four.' },
  { id: 'map-east', scope: 'map', keys: ['ArrowRight'], does: () => 'Move one place east and play it. With Shift, move four.' },
  { id: 'map-north', scope: 'map', keys: ['ArrowUp'], does: () => 'Move one place north and play it. With Shift, move four.' },
  { id: 'map-south', scope: 'map', keys: ['ArrowDown'], does: () => 'Move one place south and play it. With Shift, move four.' },
  { id: 'edge-west', scope: 'map', keys: ['Home'], does: () => 'Go to the west edge.' },
  { id: 'edge-east', scope: 'map', keys: ['End'], does: () => 'Go to the east edge.' },
  { id: 'edge-north', scope: 'map', keys: ['PageUp'], does: () => 'Go to the north edge.' },
  { id: 'edge-south', scope: 'map', keys: ['PageDown'], does: () => 'Go to the south edge.' },
  { id: 'replay', scope: 'map', keys: [' '], does: () => 'Play this place again.' },
  { id: 'sweep', scope: 'map', keys: ['Enter'], does: () => 'Play the row from west to east. With Shift, play the column from north to south.' },
  { id: 'lock', scope: 'map', keys: ['l'], does: () => 'Lock this place, so the date slider plays it on each date. Press again to unlock.' },
  { id: 'stop', scope: 'map', keys: ['Escape'], does: () => 'Stop the sound, and unlock a locked place.' },
]

/** A letter is the same key with or without Shift or Caps Lock. */
const same = (key: string) => (key.length === 1 ? key.toLowerCase() : key)

/** Which shortcut a key is in this scope, or null when it is not one. */
export function shortcutFor(key: string, scope: Scope): ShortcutId | null {
  const wanted = same(key)
  return SHORTCUTS.find(shortcut => shortcut.scope === scope && shortcut.keys.some(known => same(known) === wanted))?.id ?? null
}

const NAMES: Record<string, string> = {
  ' ': 'Space',
  ArrowLeft: 'Left arrow',
  ArrowRight: 'Right arrow',
  ArrowUp: 'Up arrow',
  ArrowDown: 'Down arrow',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
}

/** What the key is called on screen: "Space", "Left arrow", "T". */
export function keyName(key: string): string {
  return NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key)
}
