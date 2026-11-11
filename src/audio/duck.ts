// One rule for "a voice is speaking" (ticket SN13): the music drops by DUCK_DB and comes back smoothly. It never pauses.
// The guide, the browser's speech and the announcer each hold a reason; the sound engines subscribe and ramp their master gain.
// Pure: no Tone, no DOM. Module-level state is the only state; `duck.reset()` clears it for tests.

export const DUCK_DB = -18
export const DUCK_LINEAR = 10 ** (DUCK_DB / 20)
export const DUCK_ATTACK_S = 0.3
export const DUCK_RELEASE_S = 0.8

export type DuckReason = 'guide' | 'speech' | 'announcement' | 'engine'
/** `gain` is the new target (1 or DUCK_LINEAR); `rampS` is how long to take to reach it. */
export type DuckListener = (gain: number, rampS: number) => void

const SPEECH_MIN_MS = 1200
const SPEECH_MAX_MS = 6000
const SPEECH_MS_PER_CHAR = 60

const held = new Map<DuckReason, number>()
const timers = new Set<ReturnType<typeof setTimeout>>()
const listeners = new Set<DuckListener>()

const isDucked = () => held.size > 0
const targetGain = () => (isDucked() ? DUCK_LINEAR : 1)

function notify(wasDucked: boolean) {
  const ducked = isDucked()
  if (ducked === wasDucked) return
  const gain = targetGain()
  const rampS = ducked ? DUCK_ATTACK_S : DUCK_RELEASE_S
  for (const listener of [...listeners]) listener(gain, rampS)
}

function begin(reason: DuckReason) {
  const wasDucked = isDucked()
  held.set(reason, (held.get(reason) ?? 0) + 1)
  notify(wasDucked)
}

function end(reason: DuckReason) {
  const count = held.get(reason)
  if (count === undefined) return
  const wasDucked = isDucked()
  if (count <= 1) held.delete(reason)
  else held.set(reason, count - 1)
  notify(wasDucked)
}

export const duck = {
  /** Reference counted: the sound is ducked while any reason holds it. */
  begin,
  /** Ending a reason that is not held does nothing. */
  end,
  /** Begins `reason` now and ends it after `ms`. */
  for(reason: DuckReason, ms: number) {
    begin(reason)
    const timer = setTimeout(() => {
      timers.delete(timer)
      end(reason)
    }, ms)
    timers.add(timer)
  },
  /** Called by the ensemble and the engine. The listener is called at once with the current target (and no ramp). Returns the unsubscribe function. */
  subscribe(listener: DuckListener) {
    listeners.add(listener)
    listener(targetGain(), 0)
    return () => {
      listeners.delete(listener)
    }
  },
  /** The current target gain: 1, or DUCK_LINEAR. */
  target: targetGain,
  /** For tests: forget every reason, pending timer and listener (engines made by an earlier test are no longer told anything). */
  reset() {
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    held.clear()
    listeners.clear()
  },
}

/** A speech's length in ms, for the announcement duck: 1.2 s at least, 6 s at most, about 60 ms a character. */
export function speechMs(text: string): number {
  return Math.min(SPEECH_MAX_MS, Math.max(SPEECH_MIN_MS, text.length * SPEECH_MS_PER_CHAR))
}
