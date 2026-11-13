// Touch and mouse gestures as a pure state machine (ticket IX01). No DOM and no timers: the caller feeds it pointer events and, 500 ms after a press that
// has not moved, a `long-press` event. It answers with what to do. A press or a drag over the map is a place to sound; a long press is a question; a
// two-finger tap is Escape. The right button is not handled here (the caller turns a context menu into `query`).

import type { Action } from './actions'

export const LONG_PRESS_MS = 500
export const MOVE_TOLERANCE_PX = 10
export const TWO_FINGER_MS = 300

export type GestureEvent =
  | { type: 'down'; id: number; x: number; y: number; at: number }
  | { type: 'move'; id: number; x: number; y: number; at: number }
  | { type: 'up'; id: number; at: number }
  | { type: 'cancel'; id: number; at: number }
  /** The long-press timer fired. */
  | { type: 'long-press'; at: number }

export type GestureOutput =
  /** Sound the place under this point: a press, or a drag across the map. */
  | { kind: 'point'; x: number; y: number; first: boolean }
  /** The finger or pointer was lifted. */
  | { kind: 'release' }
  | { kind: 'action'; action: Action }

type Pointer = { x: number; y: number; startX: number; startY: number; downAt: number }

export type GestureState = {
  pointers: Record<number, Pointer>
  /** When the second finger came down, while two are down. */
  twoAt: number | null
  /** The press that may become a long press: it has not moved, and no second finger came. */
  pressId: number | null
  /** A long press or a two-finger tap already answered: nothing else comes from these fingers. */
  spent: boolean
}

export const START_GESTURE: GestureState = { pointers: {}, twoAt: null, pressId: null, spent: false }

export type GestureStep = {
  state: GestureState
  outputs: GestureOutput[]
  /** True when the caller should start the long-press timer now; false when it should clear it. null: leave it. */
  longPress: boolean | null
}

const moved = (p: Pointer) => Math.hypot(p.x - p.startX, p.y - p.startY) > MOVE_TOLERANCE_PX

export function stepGesture(state: GestureState, event: GestureEvent): GestureStep {
  const outputs: GestureOutput[] = []

  if (event.type === 'down') {
    const pointers = { ...state.pointers, [event.id]: { x: event.x, y: event.y, startX: event.x, startY: event.y, downAt: event.at } }
    const count = Object.keys(pointers).length
    if (count === 1) {
      outputs.push({ kind: 'point', x: event.x, y: event.y, first: true })
      return { state: { pointers, twoAt: null, pressId: event.id, spent: false }, outputs, longPress: true }
    }
    // A second finger: no long press, and a tap with two fingers may follow.
    return { state: { ...state, pointers, twoAt: count === 2 ? event.at : null, pressId: null }, outputs, longPress: false }
  }

  if (event.type === 'move') {
    const known = state.pointers[event.id]
    if (!known) return { state, outputs, longPress: null }
    const pointers = { ...state.pointers, [event.id]: { ...known, x: event.x, y: event.y } }
    const next = { ...state, pointers }
    const count = Object.keys(pointers).length
    if (count === 1 && !state.spent) outputs.push({ kind: 'point', x: event.x, y: event.y, first: false })
    // Moving far enough turns the press into a drag, and a drag is not a long press or a tap.
    if (moved(pointers[event.id])) return { state: { ...next, pressId: state.pressId === event.id ? null : state.pressId, twoAt: null }, outputs, longPress: state.pressId === event.id ? false : null }
    return { state: next, outputs, longPress: null }
  }

  if (event.type === 'long-press') {
    const press = state.pressId === null ? undefined : state.pointers[state.pressId]
    if (!press || state.spent || moved(press)) return { state, outputs, longPress: null }
    outputs.push({ kind: 'action', action: { type: 'query' } })
    return { state: { ...state, pressId: null, spent: true }, outputs, longPress: false }
  }

  // up or cancel
  const lifted = state.pointers[event.id]
  if (!lifted) return { state, outputs, longPress: null }
  const { [event.id]: _gone, ...pointers } = state.pointers
  void _gone
  const remaining = Object.keys(pointers).length
  let spent = state.spent
  // Both fingers down and up within TWO_FINGER_MS, neither having moved: a two-finger tap.
  if (event.type === 'up' && state.twoAt !== null && !spent && remaining === 1 && event.at - state.twoAt <= TWO_FINGER_MS
    && !moved(lifted) && !Object.values(pointers).some(moved)) {
    outputs.push({ kind: 'action', action: { type: 'stopSpeech' } })
    spent = true
  }
  if (remaining === 0) {
    outputs.push({ kind: 'release' })
    return { state: START_GESTURE, outputs, longPress: false }
  }
  return { state: { pointers, twoAt: null, pressId: null, spent }, outputs, longPress: false }
}
