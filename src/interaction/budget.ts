// The 50 ms answer (ticket IX01, principle 1). A sound for an input starts within ANSWER_BUDGET_MS of the event; sounds for moves arrive at most every
// MOVE_GAP_MS, and when moves come faster only the latest one sounds, at the end of the gap.

export const ANSWER_BUDGET_MS = 50
export const MOVE_GAP_MS = 50

export type GapGate = {
  /** Runs `play` now if the gap has passed since the last one; otherwise `play` replaces any that is waiting and runs at the end of the gap. */
  run: (play: () => void) => void
  /** Drops the one that is waiting. */
  cancel: () => void
}

export function createGapGate(gapMs = MOVE_GAP_MS, clock: () => number = () => Date.now()): GapGate {
  let last = -Infinity
  let waiting: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  function fire(play: () => void) {
    last = clock()
    play()
  }

  function cancel() {
    clearTimeout(timer)
    timer = undefined
    waiting = null
  }

  return {
    run(play) {
      const since = clock() - last
      // The first move after a pause plays at once. A clock that went backwards does too, rather than holding the sound back.
      if (since >= gapMs || since < 0) {
        cancel()
        fire(play)
        return
      }
      waiting = play
      if (timer !== undefined) return
      timer = setTimeout(() => {
        timer = undefined
        const next = waiting
        waiting = null
        if (next) fire(next)
      }, gapMs - since)
    },
    cancel,
  }
}
