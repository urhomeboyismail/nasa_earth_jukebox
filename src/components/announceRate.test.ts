import { describe, expect, it } from 'vitest'
import { ANNOUNCE_GAP_MS, START_RATE, dueMessage, offerMessage, type RateState } from './announceRate'

describe('announceRate', () => {
  it('speaks the first message, busy or not, at once', () => {
    expect(offerMessage(START_RATE, 'a', 0, true)).toEqual({ state: { lastAt: 0, pending: null }, speak: 'a', waitMs: null })
    expect(offerMessage(START_RATE, 'a', 0, false).speak).toBe('a')
  })

  it('holds a busy message that comes within 1.5 s, and says when it is due', () => {
    const first = offerMessage(START_RATE, 'a', 1000, true)
    const held = offerMessage(first.state, 'b', 1500, true)
    expect(held.speak).toBeNull()
    expect(held.waitMs).toBe(1000)
    expect(held.state).toEqual({ lastAt: 1000, pending: 'b' })
  })

  it('lets the newest message replace the one that is waiting, and drops the older one', () => {
    let step = offerMessage(START_RATE, 'a', 0, true)
    step = offerMessage(step.state, 'b', 500, true)
    step = offerMessage(step.state, 'c', 1000, true)
    expect(step.state.pending).toBe('c')
    expect(step.waitMs).toBe(500)
    const due = dueMessage(step.state, 1500)
    expect(due.speak).toBe('c')
    expect(due.state).toEqual({ lastAt: 1500, pending: null })
  })

  it('speaks a busy message at once when 1.5 s have passed', () => {
    const first = offerMessage(START_RATE, 'a', 0, true)
    expect(offerMessage(first.state, 'b', ANNOUNCE_GAP_MS - 1, true).speak).toBeNull()
    expect(offerMessage(first.state, 'b', ANNOUNCE_GAP_MS, true).speak).toBe('b')
  })

  it('speaks a message that is not busy at once and drops the busy one that was waiting', () => {
    const first = offerMessage(START_RATE, 'a', 0, true)
    const held = offerMessage(first.state, 'b', 200, true)
    const now = offerMessage(held.state, 'Paused', 300, false)
    expect(now.speak).toBe('Paused')
    expect(now.state.pending).toBeNull()
    expect(dueMessage(now.state, 1500).speak).toBeNull()
  })

  it('does nothing when the timer fires with nothing waiting', () => {
    const state: RateState = { lastAt: 0, pending: null }
    expect(dueMessage(state, 2000)).toEqual({ state, speak: null, waitMs: null })
  })

  it('never waits longer than one gap, even if the clock went backwards', () => {
    const first = offerMessage(START_RATE, 'a', 10_000, true)
    expect(offerMessage(first.state, 'b', 0, true).waitMs).toBe(ANNOUNCE_GAP_MS)
  })

  it('keeps to one update per 1.5 s for any run of busy messages, and the last is spoken', () => {
    let state = START_RATE
    const spoken: { at: number; text: string }[] = []
    let dueAt: number | null = null
    // One message every 500 ms for 12 messages; the timer is run when it is due.
    for (let i = 0; i < 12; i++) {
      const now = i * 500
      if (dueAt !== null && dueAt <= now) {
        const due = dueMessage(state, dueAt)
        state = due.state
        if (due.speak) spoken.push({ at: dueAt, text: due.speak })
        dueAt = null
      }
      const step = offerMessage(state, `m${i}`, now, true)
      state = step.state
      if (step.speak) spoken.push({ at: now, text: step.speak })
      else if (dueAt === null && step.waitMs !== null) dueAt = now + step.waitMs
    }
    if (dueAt !== null) {
      const due = dueMessage(state, dueAt)
      if (due.speak) spoken.push({ at: dueAt, text: due.speak })
    }
    for (let i = 1; i < spoken.length; i++) expect(spoken[i].at - spoken[i - 1].at).toBeGreaterThanOrEqual(ANNOUNCE_GAP_MS)
    expect(spoken.at(-1)?.text).toBe('m11')
  })
})
