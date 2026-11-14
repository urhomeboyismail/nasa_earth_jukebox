// Interface sounds: short tones that say what the app is doing (the voice guide connected or ended, an answer is ready, something
// failed), on any page, without the sound engine. They are a different timbre from the data (pure sine blips, very quiet), so they are
// never mistaken for a reading, and each one goes with a text announcement the caller already makes. Plain Web Audio, so no Tone.js
// is loaded for them. The listener can switch them off (SoundPrefs); where there is no AudioContext (jsdom, old browsers) nothing plays.
// Idea from Muninn's soundfx.ts.

import { readStored, useStoredValue, writeStoredText } from '../hooks/useStoredValue'

export type Cue = 'connected' | 'ended' | 'answer' | 'error'

export const CUES_KEY = 'earth-jukebox:interface-cues'

/** Each cue as [frequency in Hz, start in seconds] blips. Rising: started. Falling: ended. One note: ready. A low pair: a problem. */
export const CUE_NOTES: Record<Cue, [number, number][]> = {
  connected: [[523.25, 0], [783.99, 0.09]],
  ended: [[783.99, 0], [523.25, 0.09]],
  answer: [[659.25, 0]],
  error: [[220, 0], [220, 0.14]],
}
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

/** Plays the cue, unless the listener switched cues off or the browser cannot. Never throws. */
export function playCue(cue: Cue) {
  if (!cuesOn() || typeof AudioContext === 'undefined') return
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
  } catch {
    // A browser that refuses audio here stays quiet: the text announcement still says it.
  }
}

/** For tests: forget the AudioContext, so a new fake is picked up. */
export function resetCues() {
  context = null
}
