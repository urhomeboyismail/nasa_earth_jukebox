// Runs the demo script step by step. Everything it touches is passed in, so a test can run the whole tour on a fake clock.

import type { Page } from '../../pages'
import type { DemoStep } from './script'

export type DemoDeps = {
  goTo: (page: Page) => void
  say: (text: string) => void
  /** Starts the dates playing and resolves when they have finished (or could not start). */
  playAndWait: (signal: AbortSignal) => Promise<void>
  /** Asks one question about the next two dates and resolves when it is answered, stopped, or there was nothing to ask (IX05). Left out where there is no player: the step then just holds. */
  predictAndWait?: (signal: AbortSignal) => Promise<void>
  /** Resolves after `ms`, or at once if the demo is stopped. */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>
  /** Speaks the caption and resolves when the speech has ended. Left out when the listener has not asked for the demo to be read aloud. */
  speakCaption?: (text: string) => Promise<void>
}

/** Resolves true when the tour reached its end, false when it was stopped. */
export async function runDemo(steps: DemoStep[], deps: DemoDeps, signal: AbortSignal): Promise<boolean> {
  for (const step of steps) {
    if (signal.aborted) return false
    deps.goTo(step.page)
    deps.say(step.say)
    if (deps.speakCaption) {
      await deps.speakCaption(step.say)
      if (signal.aborted) return false
    }
    if (step.play) await deps.playAndWait(signal)
    else if (step.predict && deps.predictAndWait) await deps.predictAndWait(signal)
    else await deps.sleep(step.holdMs ?? 5000, signal)
  }
  return !signal.aborted
}
