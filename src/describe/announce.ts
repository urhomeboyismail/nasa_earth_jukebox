// How often events may be announced (docs/PLAN.md §6.3, ticket SN10). A listener's own action is always answered; an event the music produced on its
// own is held to a gap, a count a minute and a repeat window, so a screen reader is not flooded. A refused event is dropped, never queued: the next
// event after the gap is the one that counts.
//
// This is a gate in front of the live region. The live region has its own, finer throttle (src/components/announceRate.ts, T93: 1.5 s, newest wins)
// for messages sent while a sequence plays. They do different jobs and both apply: an event that passes this gate is sent with `busy` set.

export const MIN_GAP_MS = 4000
export const MAX_PER_MINUTE = 8
export const REPEAT_WINDOW_MS = 30000
const MINUTE_MS = 60000

export type Source = 'user' | 'event'

export class AnnounceLimiter {
  private readonly now: () => number
  private made: { text: string; at: number }[] = []

  constructor(now: () => number = () => Date.now()) {
    this.now = now
  }

  /** True when `text` may be announced now. A `'user'` text is always allowed. Both kinds count towards the gap and the minute. */
  offer(text: string, source: Source): boolean {
    const at = this.now()
    // A clock that went backwards must not hold the limiter shut: forget what lies in its future.
    this.made = this.made.filter(entry => entry.at <= at && at - entry.at < MINUTE_MS)
    if (source === 'event') {
      const last = this.made[this.made.length - 1]
      if (last && at - last.at < MIN_GAP_MS) return false
      if (this.made.length >= MAX_PER_MINUTE) return false
      if (this.made.some(entry => entry.text === text && at - entry.at < REPEAT_WINDOW_MS)) return false
    }
    this.made.push({ text, at })
    return true
  }
}
