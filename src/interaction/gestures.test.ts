import { describe, expect, it } from 'vitest'
import { LONG_PRESS_MS, MOVE_TOLERANCE_PX, START_GESTURE, TWO_FINGER_MS, stepGesture, type GestureEvent, type GestureOutput, type GestureState } from './gestures'

function run(events: GestureEvent[]) {
  let state: GestureState = START_GESTURE
  const outputs: GestureOutput[] = []
  const timers: (boolean | null)[] = []
  for (const event of events) {
    const step = stepGesture(state, event)
    state = step.state
    outputs.push(...step.outputs)
    timers.push(step.longPress)
  }
  return { state, outputs, timers }
}
const actions = (outputs: GestureOutput[]) => outputs.flatMap(o => (o.kind === 'action' ? [o.action.type] : []))

describe('stepGesture', () => {
  it('sounds the place at a press and starts the long-press timer', () => {
    const { outputs, timers } = run([{ type: 'down', id: 1, x: 10, y: 10, at: 0 }])
    expect(outputs).toEqual([{ kind: 'point', x: 10, y: 10, first: true }])
    expect(timers).toEqual([true])
  })

  it(`makes a query after ${LONG_PRESS_MS} ms without movement`, () => {
    const { outputs } = run([{ type: 'down', id: 1, x: 10, y: 10, at: 0 }, { type: 'long-press', at: LONG_PRESS_MS }, { type: 'up', id: 1, at: 700 }])
    expect(actions(outputs)).toEqual(['query'])
    expect(outputs.at(-1)).toEqual({ kind: 'release' })
  })

  it('makes no query when the press moved more than the tolerance', () => {
    const far = run([{ type: 'down', id: 1, x: 10, y: 10, at: 0 }, { type: 'move', id: 1, x: 10 + MOVE_TOLERANCE_PX + 1, y: 10, at: 100 }, { type: 'long-press', at: 500 }])
    expect(actions(far.outputs)).toEqual([])
    const near = run([{ type: 'down', id: 1, x: 10, y: 10, at: 0 }, { type: 'move', id: 1, x: 10 + MOVE_TOLERANCE_PX, y: 10, at: 100 }, { type: 'long-press', at: 500 }])
    expect(actions(near.outputs)).toEqual(['query'])
  })

  it('turns a drag into a place at each move, and a release at the end', () => {
    const { outputs, timers } = run([
      { type: 'down', id: 1, x: 0, y: 0, at: 0 }, { type: 'move', id: 1, x: 30, y: 0, at: 50 }, { type: 'move', id: 1, x: 60, y: 0, at: 100 }, { type: 'up', id: 1, at: 150 },
    ])
    expect(outputs.map(o => o.kind)).toEqual(['point', 'point', 'point', 'release'])
    expect(timers[1]).toBe(false)
  })

  it('makes stopSpeech of a two-finger tap, and nothing else', () => {
    const { outputs } = run([
      { type: 'down', id: 1, x: 0, y: 0, at: 0 }, { type: 'down', id: 2, x: 50, y: 0, at: 40 }, { type: 'up', id: 1, at: 120 }, { type: 'up', id: 2, at: 130 },
    ])
    expect(actions(outputs)).toEqual(['stopSpeech'])
  })

  it('does not call two fingers held longer than the limit a tap', () => {
    const { outputs } = run([
      { type: 'down', id: 1, x: 0, y: 0, at: 0 }, { type: 'down', id: 2, x: 50, y: 0, at: 40 }, { type: 'up', id: 1, at: 40 + TWO_FINGER_MS + 1 }, { type: 'up', id: 2, at: 700 },
    ])
    expect(actions(outputs)).toEqual([])
  })

  it('does not call two fingers that moved a tap, and a second finger cancels the long press', () => {
    const moved = run([
      { type: 'down', id: 1, x: 0, y: 0, at: 0 }, { type: 'down', id: 2, x: 50, y: 0, at: 40 }, { type: 'move', id: 2, x: 90, y: 0, at: 80 }, { type: 'up', id: 1, at: 120 }, { type: 'up', id: 2, at: 130 },
    ])
    expect(actions(moved.outputs)).toEqual([])
    const second = run([{ type: 'down', id: 1, x: 0, y: 0, at: 0 }, { type: 'down', id: 2, x: 50, y: 0, at: 40 }])
    expect(second.timers).toEqual([true, false])
    expect(actions(run([{ type: 'down', id: 1, x: 0, y: 0, at: 0 }, { type: 'down', id: 2, x: 50, y: 0, at: 40 }, { type: 'long-press', at: 500 }]).outputs)).toEqual([])
  })

  it('forgets everything when all the fingers are up', () => {
    expect(run([{ type: 'down', id: 1, x: 0, y: 0, at: 0 }, { type: 'up', id: 1, at: 50 }]).state).toEqual(START_GESTURE)
    expect(run([{ type: 'down', id: 1, x: 0, y: 0, at: 0 }, { type: 'cancel', id: 1, at: 50 }]).state).toEqual(START_GESTURE)
  })

  it('ignores a move or lift of a finger it never saw', () => {
    expect(run([{ type: 'move', id: 9, x: 1, y: 1, at: 0 }, { type: 'up', id: 9, at: 1 }]).outputs).toEqual([])
  })
})
