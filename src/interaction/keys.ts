// Reading a key press (ticket IX01). The shortcut list (shortcuts.ts) matches on a `KeyInput`, so it can be tested without a browser event. Letters and digits are
// matched by their physical key (`code`) when there is one, so Shift and Caps Lock do not change them; an input with no `code` falls back to `key`.

export type KeyInput = { key: string; code: string; shift: boolean; ctrl: boolean; meta: boolean; alt: boolean }

type KeyEventLike = { key: string; code?: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }

export function keyInputOf(event: KeyEventLike): KeyInput {
  return { key: event.key, code: event.code ?? '', shift: event.shiftKey, ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey }
}

/** A key by name only (no code, no modifiers). */
export function plainKey(key: string): KeyInput {
  return { key, code: '', shift: false, ctrl: false, meta: false, alt: false }
}

export const noModifier = (input: KeyInput) => !input.ctrl && !input.meta && !input.alt

/** The letter `letter` (lower case), with or without Shift or Caps Lock. */
export function isLetter(input: KeyInput, letter: string): boolean {
  if (!noModifier(input)) return false
  return input.code ? input.code === `Key${letter.toUpperCase()}` : input.key.toLowerCase() === letter
}

/** The digit `digit` on the top row. */
export function isDigit(input: KeyInput, digit: number): boolean {
  if (!noModifier(input)) return false
  return input.code ? input.code === `Digit${digit}` : input.key === String(digit)
}

/** A named key such as 'ArrowLeft' or 'Escape', with no Ctrl, Cmd or Alt (Shift is the caller's to read). */
export const isNamed = (input: KeyInput, key: string) => noModifier(input) && input.key === key

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

// Where a key already means something, so a shortcut keeps out. These are the rules the player had (F41); they live here so every source reads one copy.
export const isEditable = (target: EventTarget | null) => target instanceof HTMLElement && target.isContentEditable
export const isField = (target: EventTarget | null) => target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
/** Where typing letters is the point: a text box, a text area, a menu. A radio button or slider is not. */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (['TEXTAREA', 'SELECT'].includes(target.tagName) || (target instanceof HTMLInputElement && !['radio', 'checkbox', 'range', 'button'].includes(target.type)))
/** Space presses these natively. A range input is not here: Space does nothing on it, so the shortcut may use it. */
export const spaceActivates = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (['BUTTON', 'A', 'SUMMARY', 'TEXTAREA', 'SELECT'].includes(target.tagName) || (target instanceof HTMLInputElement && target.type !== 'range'))
