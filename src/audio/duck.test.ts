import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DUCK_ATTACK_S, DUCK_DB, DUCK_LINEAR, DUCK_RELEASE_S, duck, speechMs } from './duck'

let calls: [number, number][]
let unsubscribe: () => void

beforeEach(() => {
  vi.useFakeTimers()
  duck.reset()
  calls = []
  unsubscribe = duck.subscribe((gain, rampS) => calls.push([gain, rampS]))
  calls.length = 0 // the first call is the current target, made at once
})
afterEach(() => {
  unsubscribe()
  duck.reset()
  vi.useRealTimers()
})

describe('the duck controller', () => {
  it('is 18 dB down, about 0.126', () => {
    expect(DUCK_DB).toBe(-18)
    expect(DUCK_LINEAR).toBeCloseTo(0.1259, 4)
  })

  it('tells a new listener the current target at once', () => {
    duck.begin('guide')
    const seen: [number, number][] = []
    const stop = duck.subscribe((gain, rampS) => seen.push([gain, rampS]))
    expect(seen).toEqual([[DUCK_LINEAR, 0]])
    stop()
  })

  it('gives a listener (DUCK_LINEAR, 0.3) on a duck and (1, 0.8) on a release', () => {
    duck.begin('guide')
    expect(calls).toEqual([[DUCK_LINEAR, DUCK_ATTACK_S]])
    duck.end('guide')
    expect(calls.at(-1)).toEqual([1, DUCK_RELEASE_S])
    expect(DUCK_ATTACK_S).toBe(0.3)
    expect(DUCK_RELEASE_S).toBe(0.8)
  })

  it('stays ducked until every reason has ended', () => {
    duck.begin('guide')
    duck.begin('speech')
    duck.end('guide')
    expect(duck.target()).toBe(DUCK_LINEAR)
    expect(calls).toHaveLength(1)
    duck.end('speech')
    expect(duck.target()).toBe(1)
    expect(calls).toHaveLength(2)
  })

  it('counts: a reason begun twice needs two ends', () => {
    duck.begin('speech')
    duck.begin('speech')
    duck.end('speech')
    expect(duck.target()).toBe(DUCK_LINEAR)
    duck.end('speech')
    expect(duck.target()).toBe(1)
  })

  it('does nothing when a reason that is not held ends', () => {
    duck.end('guide')
    expect(calls).toEqual([])
    duck.begin('speech')
    duck.end('guide')
    expect(duck.target()).toBe(DUCK_LINEAR)
    expect(calls).toHaveLength(1)
  })

  it('for() ducks now and releases after the given time', () => {
    duck.for('announcement', 1500)
    expect(duck.target()).toBe(DUCK_LINEAR)
    vi.advanceTimersByTime(1499)
    expect(duck.target()).toBe(DUCK_LINEAR)
    vi.advanceTimersByTime(1)
    expect(duck.target()).toBe(1)
  })

  it('stops calling a listener that has unsubscribed', () => {
    unsubscribe()
    duck.begin('guide')
    expect(calls).toEqual([])
  })

  it('reset() clears reasons, pending timers and listeners', () => {
    duck.for('announcement', 1000)
    duck.begin('guide')
    duck.reset()
    expect(duck.target()).toBe(1)
    calls.length = 0
    duck.begin('speech')
    expect(calls).toEqual([]) // the listener is gone
    duck.reset()
    duck.begin('speech')
    vi.advanceTimersByTime(5000)
    expect(duck.target()).toBe(DUCK_LINEAR) // the old timer did not end the new reason
  })
})

describe('speechMs', () => {
  it('is 1200 ms for a short text', () => {
    expect(speechMs('')).toBe(1200)
    expect(speechMs('Hi')).toBe(1200)
  })
  it('is 6000 ms for a long text', () => {
    expect(speechMs('x'.repeat(500))).toBe(6000)
  })
  it('is about 60 ms a character in between', () => {
    expect(speechMs('x'.repeat(50))).toBe(3000)
  })
})

describe('golden', () => {
  it('records the (gain, rampS) calls for a fixed script', async () => {
    const script: [string, number][] = []
    const record = (label: string) => script.push([label, calls.length])
    duck.begin('guide'); record('begin guide')
    duck.begin('speech'); record('begin speech')
    duck.end('guide'); record('end guide')
    duck.end('speech'); record('end speech')
    duck.end('speech'); record('end speech again')
    duck.for('announcement', speechMs('The map changed.')); record('for announcement')
    vi.advanceTimersByTime(1199); record('1199 ms')
    vi.advanceTimersByTime(1); record('1200 ms')
    duck.for('announcement', 2000)
    duck.for('announcement', 500)
    vi.advanceTimersByTime(500); record('500 ms later')
    vi.advanceTimersByTime(1500); record('2000 ms later')
    await expect(JSON.stringify({ calls, script }, null, 2) + '\n').toMatchFileSnapshot('__golden__/duck.json')
  })
})
