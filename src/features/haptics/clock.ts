// The audio clock for haptics (ticket IX10). Vibration fires when the code runs, not when the sound leaves the speaker, so a pulse is
// scheduled for the wall time (performance.now()) at which the audio at a given context time is heard.

/** The parts of an AudioContext this needs. The sound engine's `now()` is `currentTime`; a context may also know its output delay. */
export type AudioClock = {
  currentTime: number
  outputLatency?: number
  baseLatency?: number
  getOutputTimestamp?: () => { contextTime?: number; performanceTime?: number }
}

/**
 * The `performance.now()` value (ms) at which the audio at `contextTime` (seconds) leaves the speaker.
 * With `getOutputTimestamp`, from the pair of times the browser reports for what is sounding now. Without it, from the clock now plus the
 * output latency (or the base latency, or 0). A timestamp the browser has not filled in yet (before any sound) falls back the same way.
 */
export function wallTimeOf(clock: AudioClock, contextTime: number, nowMs: number = performance.now()): number {
  const { contextTime: heardAt, performanceTime: heardAtMs } = clock.getOutputTimestamp?.() ?? {}
  if (typeof heardAt === 'number' && typeof heardAtMs === 'number' && Number.isFinite(heardAt) && Number.isFinite(heardAtMs) && heardAtMs > 0) {
    return heardAtMs + (contextTime - heardAt) * 1000
  }
  const latency = clock.outputLatency ?? clock.baseLatency ?? 0
  return nowMs + (contextTime - clock.currentTime + latency) * 1000
}
