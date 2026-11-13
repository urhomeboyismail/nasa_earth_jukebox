// The one list of things a listener can do on Listen (docs/PLAN.md §6.3, ticket IX01). A key, a touch, a mouse click and a gamepad button each become one of
// these, and `dispatch` (registry.ts) hands it to whoever registered for it. Other IX tickets add a member only when they need one, and say so in their Touches.

import type { VoiceId } from '../data/sonification'

export type Action =
  /** Cells on the sound map; Shift = 4. Clamped to the map. */
  | { type: 'move'; dx: number; dy: number }
  /** A place on the sound map. A missing `col` or `row` keeps the cursor's; `Infinity` is the far edge. `via: 'pointer'` is a finger or a mouse (it never gets the edge cue). */
  | { type: 'moveTo'; col?: number; row?: number; via?: 'pointer' }
  /** Enter, Shift+Enter. */
  | { type: 'sweep'; line: 'row' | 'column' }
  | { type: 'replayPlace' }
  /** L: lock or unlock this place. */
  | { type: 'lock' }
  /** T: trace the warm edge (change style). */
  | { type: 'trace' }
  | { type: 'scrubTime'; by: number }
  | { type: 'scrubTime'; to: 'first' | 'last' }
  | { type: 'transport'; command: 'play' | 'pause' | 'toggle' }
  /** Escape, a two-finger tap, gamepad B. */
  | { type: 'stopSpeech' }
  /** I, a long press, a right click, gamepad X (IX02). */
  | { type: 'query' }
  /** M (IX08). */
  | { type: 'mark' }
  /** 1 to 7, Shift+1 to 7 (IX06). */
  | { type: 'voice'; voice: VoiceId; how: 'solo' | 'mute' }
  /** H, [, ] (IX03). */
  | { type: 'follow'; step: 'toggle' | 'next' | 'previous' }
  /** F (IX04). */
  | { type: 'find'; command: 'start' | 'stop' | 'toggle' }
  /** E, or the voice guide (IX09): a sound beacon at a hot spot's id or a compass place. No target (the E key) is the next place in the offline order. */
  | { type: 'point'; target?: string }
  /** Hold A or B (IX07). */
  | { type: 'compareHold'; side: 'A' | 'B'; held: boolean }
  /** Shift+A, Shift+B (IX07). */
  | { type: 'compareSet'; side: 'A' | 'B' }
  /** Ctrl+Z, Cmd+Z, gamepad View. */
  | { type: 'undo' }
  /** ? (the shortcuts dialog reads the same list). */
  | { type: 'openShortcuts' }

export type ActionType = Action['type']
export type ActionOf<T extends ActionType> = Extract<Action, { type: T }>
