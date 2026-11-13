// Speech under the listener's control (ticket IX01). Escape stops what this app says; it cannot silence a screen reader, which the shortcut's label says.

export const SPEECH_GAP_MS = 4000

const stoppers = new Set<() => void>()

/** Something that talks (the voice guide's playback, the welcome page's reader) registers how to stop it. Returns the way to unregister. */
export function registerSpeechStopper(stop: () => void): () => void {
  stoppers.add(stop)
  return () => {
    stoppers.delete(stop)
  }
}

/** Stops the browser's speech and every registered stopper. */
export function stopSpeech(): void {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  for (const stop of [...stoppers]) stop()
}

/**
 * A gate for speech the app starts on its own (an event sentence, a lost hot spot): it is spoken only if `allow(now)` says so, and dropped otherwise,
 * never queued. A sentence the listener asked for skips the gate.
 */
export function createSpeechGate(gapMs = SPEECH_GAP_MS): { allow: (now: number) => boolean } {
  let last = -Infinity
  return {
    allow(now) {
      // A clock that went backwards must not hold the gate shut.
      if (now >= last && now - last < gapMs) return false
      last = now
      return true
    },
  }
}
