// Interface sounds: short tones that say what the app is doing (the voice guide connected or ended, an answer is ready, something
// failed), on any page, without the sound engine. They are a different timbre from the data (pure sine blips, very quiet), so they are
// never mistaken for a reading, and each one goes with a text announcement the caller already makes. Plain Web Audio, so no Tone.js
// is loaded for them. The listener can switch them off (SoundPrefs); where there is no AudioContext (jsdom, old browsers) nothing plays.
// Idea from Muninn's soundfx.ts.

import { duck } from './duck'
import { readStored, useStoredValue, writeStoredText } from '../hooks/useStoredValue'

export type Cue = 'connected' | 'ended' | 'answer' | 'error' | 'start' | 'stop' | 'compareA' | 'compareB' | 'success'

export const CUES_KEY = 'earth-jukebox:interface-cues'

/** Each cue as [frequency in Hz, start in seconds] blips. Rising: started. Falling: ended. One note: ready. A low pair: a problem. */
export const CUE_NOTES: Record<Cue, [number, number][]> = {
  connected: [[523.25, 0], [783.99, 0.09]],
  ended: [[783.99, 0], [523.25, 0.09]],
  answer: [[659.25, 0]],
  error: [[220, 0], [220, 0.14]],
  // Playback: a rising pair when a sequence starts, a falling pair when it ends.
  start: [[587.33, 0], [880, 0.09]],
  stop: [[880, 0], [587.33, 0.09]],
  // Compare: one soft blip before date A, two before date B. Lower and softer than the others, so they are heard as "A" and "B", not as news.
  compareA: [[493.88, 0]],
  compareB: [[493.88, 0], [493.88, 0.12]],
  // A save, copy or link was made: three short rising blips.
  success: [[523.25, 0], [659.25, 0.08], [783.99, 0.16]],
}
/** The cues of playback, Compare and success wait for the voice guide (and any other voice) to stop: they must not talk over a sentence. */
const WAIT_FOR_VOICE: ReadonlySet<Cue> = new Set<Cue>(['start', 'stop', 'compareA', 'compareB', 'success'])
const BLIP_S = 0.09
const LEVEL = 0.04

const parse = (text: string) => text !== 'off'

export function cuesOn(): boolean {
  return readStored(CUES_KEY, parse, true)
}

export function setCuesOn(on: boolean) {
  writeStoredText(CUES_KEY, on ? null : 'off')
}

export function useCuesOn(): boolean {
  return useStoredValue(CUES_KEY, parse, true)[0]
}

let context: AudioContext | null = null

/** How long the cue sounds, in ms. */
export const cueMs = (cue: Cue) => Math.round(1000 * Math.max(...CUE_NOTES[cue].map(([, start]) => start + BLIP_S)))

/** Plays the cue, unless the listener switched cues off or the browser cannot. Never throws. Returns how long it sounds in ms (0 when it did not play). */
export function playCue(cue: Cue): number {
  if (!cuesOn() || typeof AudioContext === 'undefined') return 0
  if (WAIT_FOR_VOICE.has(cue) && duck.target() < 1) return 0
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    for (const [frequency, start] of CUE_NOTES[cue]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now + start)
      gain.gain.setValueAtTime(LEVEL, now + start)
      gain.gain.linearRampToValueAtTime(0, now + start + BLIP_S)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now + start)
      oscillator.stop(now + start + BLIP_S)
    }
    return cueMs(cue)
  } catch {
    // A browser that refuses audio here stays quiet: the text announcement still says it.
    return 0
  }
}

/** For tests: forget the AudioContext, so a new fake is picked up. */
export function resetCues() {
  context = null
}
