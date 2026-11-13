// The gamepad as a pure step function (ticket IX01). Each poll gives the buttons and the stick as they are now; `stepGamepad` answers with the actions that
// follow. A held button gives one action, not a stream. The left stick repeats at STICK_CELLS_PER_S while it is held past the dead zone. Standard mapping only.

import type { Action } from './actions'

export const STICK_DEADZONE = 0.25
export const STICK_CELLS_PER_S = 8

/** The standard gamepad's button numbers. */
export const BUTTON = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const

/** What each button does when it goes down. `held` buttons also say so when they come up. */
export const GAMEPAD_BINDINGS: { button: number; name: string; does: string; press: Action; release?: Action }[] = [
  { button: BUTTON.UP, name: 'D-pad up', does: 'Move one place north.', press: { type: 'move', dx: 0, dy: -1 } },
  { button: BUTTON.DOWN, name: 'D-pad down', does: 'Move one place south.', press: { type: 'move', dx: 0, dy: 1 } },
  { button: BUTTON.LEFT, name: 'D-pad left', does: 'Go to the date before.', press: { type: 'scrubTime', by: -1 } },
  { button: BUTTON.RIGHT, name: 'D-pad right', does: 'Go to the next date.', press: { type: 'scrubTime', by: 1 } },
  { button: BUTTON.A, name: 'A', does: 'Play or pause the dates.', press: { type: 'transport', command: 'toggle' } },
  { button: BUTTON.B, name: 'B', does: 'Stop the sound and what is being said.', press: { type: 'stopSpeech' } },
  { button: BUTTON.X, name: 'X', does: 'Ask what is here.', press: { type: 'query' } },
  { button: BUTTON.Y, name: 'Y', does: 'Mark this moment.', press: { type: 'mark' } },
  { button: BUTTON.LB, name: 'LB', does: 'Follow the previous hot spot.', press: { type: 'follow', step: 'previous' } },
  { button: BUTTON.RB, name: 'RB', does: 'Follow the next hot spot.', press: { type: 'follow', step: 'next' } },
  { button: BUTTON.LT, name: 'LT (hold)', does: 'Hold date A in the left ear.', press: { type: 'compareHold', side: 'A', held: true }, release: { type: 'compareHold', side: 'A', held: false } },
  { button: BUTTON.RT, name: 'RT (hold)', does: 'Hold date B in the right ear.', press: { type: 'compareHold', side: 'B', held: true }, release: { type: 'compareHold', side: 'B', held: false } },
  { button: BUTTON.L3, name: 'Left stick click', does: 'Lock or unlock this place.', press: { type: 'lock' } },
  { button: BUTTON.R3, name: 'Right stick click', does: 'Play this place again.', press: { type: 'replayPlace' } },
  { button: BUTTON.VIEW, name: 'View', does: 'Undo your last step.', press: { type: 'undo' } },
  { button: BUTTON.MENU, name: 'Menu', does: 'Start or stop the find game.', press: { type: 'find', command: 'toggle' } },
]

export type PadReading = { buttons: boolean[]; axes: number[] }

export type PadState = {
  /** Which buttons were down at the last poll. */
  down: boolean[]
  /** Cells the stick has earned but not yet spent, per axis. */
  owed: { x: number; y: number }
  at: number | null
}

export const START_PAD: PadState = { down: [], owed: { x: 0, y: 0 }, at: null }

export type PadStep = { state: PadState; actions: Action[] }

/** One poll at time `now` (ms). */
export function stepGamepad(state: PadState, reading: PadReading, now: number): PadStep {
  const actions: Action[] = []

  for (const binding of GAMEPAD_BINDINGS) {
    const was = state.down[binding.button] ?? false
    const is = reading.buttons[binding.button] ?? false
    if (is && !was) actions.push(binding.press)
    else if (!is && was && binding.release) actions.push(binding.release)
  }

  // The stick: past the dead zone it earns cells at STICK_CELLS_PER_S, in the direction it points.
  const dt = state.at === null ? 0 : Math.max(0, (now - state.at) / 1000)
  const sign = (value: number | undefined) => (value === undefined || Math.abs(value) < STICK_DEADZONE ? 0 : Math.sign(value))
  const axisX = sign(reading.axes[0])
  const axisY = sign(reading.axes[1])
  let owedX = axisX === 0 ? 0 : (Math.sign(state.owed.x) === axisX ? state.owed.x : 0) + axisX * STICK_CELLS_PER_S * dt
  let owedY = axisY === 0 ? 0 : (Math.sign(state.owed.y) === axisY ? state.owed.y : 0) + axisY * STICK_CELLS_PER_S * dt
  const dx = Math.trunc(owedX)
  const dy = Math.trunc(owedY)
  owedX -= dx
  owedY -= dy
  if (dx !== 0 || dy !== 0) actions.push({ type: 'move', dx, dy })

  return { state: { down: reading.buttons.map(Boolean), owed: { x: owedX, y: owedY }, at: now }, actions }
}

/** A gamepad this layer understands: connected, and with the standard layout. */
export const isStandardPad = (pad: { connected: boolean; mapping: string } | null): boolean => pad !== null && pad.connected && pad.mapping === 'standard'
