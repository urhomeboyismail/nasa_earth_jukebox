// Runs the demo script step by step. Everything it touches is passed in, so a test can run the whole tour on a fake clock.

import type { Page } from '../../pages'
import type { DemoStep } from './script'

export type DemoDeps = {
  goTo: (page: Page) => void
  say: (text: string) => void
  /** Starts the dates playing and resolves when they have finished (or could not start). */
  playAndWait: (signal: AbortSignal) => Promise<void>
  /** Resolves after `ms`, or at once if the demo is stopped. */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>
}

/** Resolves true when the tour reached its end, false when it was stopped. */
export async function runDemo(steps: DemoStep[], deps: DemoDeps, signal: AbortSignal): Promise<boolean> {
  for (const step of steps) {
    if (signal.aborted) return false
    deps.goTo(step.page)
    deps.say(step.say)
    if (step.play) await deps.playAndWait(signal)
    else await deps.sleep(step.holdMs ?? 5000, signal)
  }
  return !signal.aborted
}
