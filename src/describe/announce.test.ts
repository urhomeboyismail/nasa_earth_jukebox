import { describe, expect, it } from 'vitest'
import { AnnounceLimiter, MAX_PER_MINUTE, MIN_GAP_MS, REPEAT_WINDOW_MS } from './announce'

function limiter() {
  const clock = { now: 0 }
  return { clock, limiter: new AnnounceLimiter(() => clock.now) }
}

describe('AnnounceLimiter', () => {
  it('makes one of four different events within a second', () => {
    const { clock, limiter: l } = limiter()
    const made = [0, 300, 600, 900].map((at, i) => {
      clock.now = at
      return l.offer(`event ${i}`, 'event')
    })
    expect(made).toEqual([true, false, false, false])
  })

  it('makes an event once the gap has passed, and refuses one a moment before', () => {
    const { clock, limiter: l } = limiter()
    expect(l.offer('a', 'event')).toBe(true)
    clock.now = MIN_GAP_MS - 1
    expect(l.offer('b', 'event')).toBe(false)
    clock.now = MIN_GAP_MS
    expect(l.offer('b', 'event')).toBe(true)
  })

  it('refuses the ninth event in a minute', () => {
    const { clock, limiter: l } = limiter()
    const made: boolean[] = []
    for (let i = 0; i < MAX_PER_MINUTE + 1; i++) {
      clock.now = i * MIN_GAP_MS * 0.9 + i * 400
      made.push(l.offer(`event ${i}`, 'event'))
    }
    // Each event is just over the gap after the last (3.6 s + 0.4 s = 4 s), so only the minute count can refuse the ninth (at 32 s).
    expect(made.slice(0, MAX_PER_MINUTE).every(Boolean)).toBe(true)
    expect(made[MAX_PER_MINUTE]).toBe(false)
    clock.now = 61_000
    expect(l.offer('later', 'event')).toBe(true)
  })

  it('refuses the same text again within 30 s, and allows it after', () => {
    const { clock, limiter: l } = limiter()
    expect(l.offer('same', 'event')).toBe(true)
    clock.now = 10_000
    expect(l.offer('other', 'event')).toBe(true)
    clock.now = 20_000
    expect(l.offer('same', 'event')).toBe(false)
    clock.now = REPEAT_WINDOW_MS + 1
    expect(l.offer('same', 'event')).toBe(true)
  })

  it('drops a refused event: it is not made later, and does not count', () => {
    const { clock, limiter: l } = limiter()
    expect(l.offer('a', 'event')).toBe(true)
    clock.now = 1000
    expect(l.offer('b', 'event')).toBe(false)
    clock.now = MIN_GAP_MS
    expect(l.offer('c', 'event')).toBe(true)
  })

  it('always makes a listener’s own answer, even in the gap, over the count and a repeat', () => {
    const { clock, limiter: l } = limiter()
    expect(l.offer('Detail: Full.', 'user')).toBe(true)
    expect(l.offer('Detail: Full.', 'user')).toBe(true)
    for (let i = 0; i < 20; i++) {
      clock.now += 10
      expect(l.offer(`answer ${i}`, 'user')).toBe(true)
    }
  })

  it('counts a listener’s answer towards the gap, so an event does not talk over it', () => {
    const { clock, limiter: l } = limiter()
    l.offer('Symphony mode.', 'user')
    clock.now = 1000
    expect(l.offer('A new hot area appeared in the north.', 'event')).toBe(false)
    clock.now = MIN_GAP_MS
    expect(l.offer('A new hot area appeared in the north.', 'event')).toBe(true)
  })

  it('is not held shut by a clock that went backwards', () => {
    const { clock, limiter: l } = limiter()
    clock.now = 100_000
    l.offer('a', 'event')
    clock.now = 0
    expect(l.offer('b', 'event')).toBe(true)
  })
})
