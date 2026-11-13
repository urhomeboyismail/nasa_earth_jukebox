import { describe, expect, it } from 'vitest'
import type { Action } from '../../interaction/actions'
import { MOVES_NEEDED, START, STEP_IDS, advance, isDone, landsOnAnotherPlace, promptFor, type GameEvent, type Progress } from './steps'

const move: Action = { type: 'move', dx: 1, dy: 0 }
const found: GameEvent = { type: 'found' }
const query: Action = { type: 'query' }
const lock: Action = { type: 'lock' }
const scrub: Action = { type: 'scrubTime', by: 1 }
const moves = (count: number): GameEvent[] => Array.from({ length: count }, () => move)
const run = (events: GameEvent[], from: Progress = START) => events.reduce(advance, from)

describe('the first-minute steps', () => {
  it('needs three moves for the first step, and not fewer', () => {
    expect(run(moves(MOVES_NEEDED - 1)).step).toBe(0)
    expect(run(moves(MOVES_NEEDED)).step).toBe(1)
  })

  it('is met at each step by its own action only', () => {
    const at = (step: number): Progress => ({ ...START, step })
    const own: Record<string, GameEvent> = { move, find: found, query, lock }
    const others: GameEvent[] = [move, found, query, scrub, { type: 'moveTo', col: 1 }, { type: 'find', command: 'toggle' }]
    STEP_IDS.forEach((id, step) => {
      for (const event of others) {
        if (event === own[id]) continue
        // A move counts toward step 0 but does not finish it by itself.
        if (id === 'move' && event.type === 'move') continue
        const here = at(step)
        expect(advance(here, event), `${event.type} at step ${id}`).toBe(here)
      }
    })
  })

  it('holds the order: a later step cannot be done early', () => {
    expect(run([query, found, lock, scrub]).step).toBe(0)
    expect(run([...moves(MOVES_NEEDED), query]).step).toBe(1)
    expect(run([...moves(MOVES_NEEDED), found, lock, scrub]).step).toBe(2)
  })

  it('reaches done through the four tasks, with the lock before the date change', () => {
    expect(isDone(run([...moves(MOVES_NEEDED), found, query, lock, scrub]))).toBe(true)
    expect(isDone(run([...moves(MOVES_NEEDED), found, query, scrub, lock]))).toBe(false)
  })

  it('treats a second L as unlocking, so the date change then does not count', () => {
    const afterQuery = run([...moves(MOVES_NEEDED), found, query])
    expect(isDone(run([lock, lock, scrub], afterQuery))).toBe(false)
    expect(isDone(run([lock, lock, lock, scrub], afterQuery))).toBe(true)
  })

  it('gives the same steps for the same actions and ignores events once done', () => {
    const events: GameEvent[] = [...moves(MOVES_NEEDED), found, query, lock, scrub]
    expect(run(events)).toStrictEqual(run(events))
    const done = run(events)
    expect(advance(done, move)).toBe(done)
  })

  it("says the data set's own word for the find step and names no data set", () => {
    expect(promptFor('find', { highest: 'warmest' })).toBe('Find the warmest place. Press F to start the find game.')
    expect(promptFor('find', { highest: 'wettest' })).toContain('wettest')
  })
})

describe('landsOnAnotherPlace', () => {
  const size = { cols: 24, rows: 12 }
  it('is true inside the map, including a clamped Shift move that still goes somewhere', () => {
    expect(landsOnAnotherPlace({ type: 'move', dx: 1, dy: 0 }, { col: 5, row: 5 }, size)).toBe(true)
    expect(landsOnAnotherPlace({ type: 'move', dx: 4, dy: 0 }, { col: 22, row: 5 }, size)).toBe(true)
  })
  it('is false against each edge, where the cursor stays', () => {
    expect(landsOnAnotherPlace({ type: 'move', dx: -1, dy: 0 }, { col: 0, row: 5 }, size)).toBe(false)
    expect(landsOnAnotherPlace({ type: 'move', dx: 1, dy: 0 }, { col: 23, row: 5 }, size)).toBe(false)
    expect(landsOnAnotherPlace({ type: 'move', dx: 0, dy: -4 }, { col: 5, row: 0 }, size)).toBe(false)
    expect(landsOnAnotherPlace({ type: 'move', dx: 0, dy: 1 }, { col: 5, row: 11 }, size)).toBe(false)
  })
})
