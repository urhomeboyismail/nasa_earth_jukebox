import { describe, expect, it } from 'vitest'
import { BUTTON, GAMEPAD_BINDINGS, START_PAD, STICK_CELLS_PER_S, STICK_DEADZONE, isStandardPad, stepGamepad, type PadReading, type PadState } from './gamepad'

const reading = (pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): PadReading => ({ buttons: Array.from({ length: 17 }, (_, i) => pressed.includes(i)), axes })

describe('stepGamepad: buttons', () => {
  it('turns each button of the table into its action, once, when it goes down', () => {
    for (const binding of GAMEPAD_BINDINGS) {
      const down = stepGamepad(START_PAD, reading([binding.button]), 0)
      expect(down.actions, binding.name).toEqual([binding.press])
    }
  })

  it('gives one action for a held button, not a stream', () => {
    let state: PadState = START_PAD
    const all: unknown[] = []
    for (let t = 0; t < 10; t++) {
      const step = stepGamepad(state, reading([BUTTON.A]), t * 16)
      state = step.state
      all.push(...step.actions)
    }
    expect(all).toEqual([{ type: 'transport', command: 'toggle' }])
  })

  it('says a held trigger is held, and let go when it comes up', () => {
    const down = stepGamepad(START_PAD, reading([BUTTON.LT]), 0)
    expect(down.actions).toEqual([{ type: 'compareHold', side: 'A', held: true }])
    expect(stepGamepad(down.state, reading([]), 16).actions).toEqual([{ type: 'compareHold', side: 'A', held: false }])
    expect(stepGamepad(START_PAD, reading([BUTTON.RT]), 0).actions).toEqual([{ type: 'compareHold', side: 'B', held: true }])
  })

  it('maps the d-pad to one cell north or south and one date either way', () => {
    expect(stepGamepad(START_PAD, reading([BUTTON.UP]), 0).actions).toEqual([{ type: 'move', dx: 0, dy: -1 }])
    expect(stepGamepad(START_PAD, reading([BUTTON.DOWN]), 0).actions).toEqual([{ type: 'move', dx: 0, dy: 1 }])
    expect(stepGamepad(START_PAD, reading([BUTTON.LEFT]), 0).actions).toEqual([{ type: 'scrubTime', by: -1 }])
    expect(stepGamepad(START_PAD, reading([BUTTON.RIGHT]), 0).actions).toEqual([{ type: 'scrubTime', by: 1 }])
  })
})

describe('stepGamepad: the left stick', () => {
  /** Holds the stick for `ms`, polling every 16 ms, and returns the cells moved. */
  function hold(axes: number[], ms: number) {
    let state: PadState = START_PAD
    let dx = 0
    let dy = 0
    for (let t = 0; t <= ms; t += 16) {
      const step = stepGamepad(state, reading([], axes), t)
      state = step.state
      for (const action of step.actions) {
        if (action.type === 'move') {
          dx += action.dx
          dy += action.dy
        }
      }
    }
    return { dx, dy }
  }

  it(`moves ${STICK_CELLS_PER_S} cells a second while it is held`, () => {
    const moved = hold([1, 0], 2000)
    expect(moved.dx).toBeGreaterThanOrEqual(STICK_CELLS_PER_S * 2 - 1)
    expect(moved.dx).toBeLessThanOrEqual(STICK_CELLS_PER_S * 2)
    expect(moved.dy).toBe(0)
  })

  it('moves both axes at once, and in the direction it points', () => {
    const moved = hold([-1, 1], 1000)
    expect(moved.dx).toBeLessThanOrEqual(-STICK_CELLS_PER_S + 1)
    expect(moved.dy).toBeGreaterThanOrEqual(STICK_CELLS_PER_S - 1)
  })

  it('ignores the stick inside the dead zone', () => {
    expect(hold([STICK_DEADZONE - 0.01, -(STICK_DEADZONE - 0.01)], 2000)).toEqual({ dx: 0, dy: 0 })
  })

  it('does not move on the first poll, which has no time behind it', () => {
    expect(stepGamepad(START_PAD, reading([], [1, 0]), 5000).actions).toEqual([])
  })
})

describe('isStandardPad', () => {
  it('accepts only a connected pad with the standard layout', () => {
    expect(isStandardPad({ connected: true, mapping: 'standard' })).toBe(true)
    expect(isStandardPad({ connected: true, mapping: '' })).toBe(false)
    expect(isStandardPad({ connected: false, mapping: 'standard' })).toBe(false)
    expect(isStandardPad(null)).toBe(false)
  })
})
