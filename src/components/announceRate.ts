// How often the shared live region may change (T93). While a sequence or a sweep plays, a screen reader that is told about every
// step talks over the sound and falls behind, so busy messages get at most one update per 1.5 s: the newest message replaces
// the one that is waiting (older ones are dropped, never queued) and the last one is always spoken. Pure: the provider keeps
// the state and the timer, this file only decides.

/** The shortest time between two updates while busy. */
export const ANNOUNCE_GAP_MS = 1500

export type RateState = {
  /** When the live region last changed. */
  lastAt: number
  /** The newest busy message that is waiting for its turn. */
  pending: string | null
}

export const START_RATE: RateState = { lastAt: -Infinity, pending: null }

export type RateStep = {
  state: RateState
  /** Text to put in the live region now, or null. */
  speak: string | null
  /** When a message is waiting: how long until it is due, so the caller sets one timer. Null when nothing waits. */
  waitMs: number | null
}

/**
 * A message arrives at `now`. A message that is not busy (a button press, a pause, the end of a sweep) is spoken at once and
 * drops any busy message still waiting. A busy message is spoken at once if the last update is 1.5 s old, otherwise it takes the
 * place of the one that is waiting.
 */
export function offerMessage(state: RateState, text: string, now: number, busy: boolean, gapMs = ANNOUNCE_GAP_MS): RateStep {
  if (!busy || now - state.lastAt >= gapMs) return { state: { lastAt: now, pending: null }, speak: text, waitMs: null }
  // A clock that went backwards must not hold a message for longer than one gap.
  const waitMs = Math.min(gapMs, Math.max(0, state.lastAt + gapMs - now))
  return { state: { lastAt: state.lastAt, pending: text }, speak: null, waitMs }
}

/** The timer from `offerMessage` fired at `now`: speak the message that was waiting, if it is still there. */
export function dueMessage(state: RateState, now: number): RateStep {
  if (state.pending === null) return { state, speak: null, waitMs: null }
  return { state: { lastAt: now, pending: null }, speak: state.pending, waitMs: null }
}
