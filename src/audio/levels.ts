// A listener on the sound that is already playing (docs/tickets/JB03-audio-chest.md): one AnalyserNode fed from Tone's shared destination,
// read by Echo's chest bars and globe. It never creates, resumes or loads an audio context: whoever calls `attachLevels` already has Tone
// running, after a click. The analyser is connected from the destination and to nothing, so the sound is unchanged.

/** One per EQ bar on Echo's chest (`RESTING_LEVELS` in src/components/mascotTypes.ts has four). */
export const LEVEL_BANDS = 4
const FFT_SIZE = 256

/** The part of an AnalyserNode that is read. */
type AnalyserLike = Pick<AnalyserNode, 'fftSize' | 'frequencyBinCount' | 'getByteFrequencyData' | 'getByteTimeDomainData'>

/** What this file needs from Tone (the real module fits, with A as AnalyserNode), so a test can pass a small fake. */
type ToneLike<A extends AnalyserLike> = {
  getContext(): { createAnalyser(): A }
  getDestination(): { connect(node: A): unknown; disconnect(node: A): unknown }
}

type Tap = {
  analyser: AnalyserLike
  disconnect: () => void
  freq: Uint8Array<ArrayBuffer>
  wave: Uint8Array<ArrayBuffer>
}

let tap: Tap | null = null

/** Averages of `freq` in `bands` bands, spaced evenly on a log scale (low bands are narrow). Pure. */
export function bandsFrom(freq: Uint8Array, bands: number): Uint8Array {
  const out = new Uint8Array(Math.max(0, Math.floor(bands)))
  if (out.length === 0 || freq.length === 0) return out
  let from = 0
  for (let band = 0; band < out.length; band++) {
    const last = band === out.length - 1
    const to = last ? freq.length : Math.min(freq.length, Math.max(from + 1, Math.round(freq.length ** ((band + 1) / out.length))))
    if (to > from) {
      let sum = 0
      for (let i = from; i < to; i++) sum += freq[i]
      out[band] = Math.round(sum / (to - from))
    }
    from = Math.min(to, freq.length)
  }
  return out
}

/** Puts the analyser on Tone's output. Safe to call again: there is only ever one. */
export function attachLevels<A extends AnalyserLike>(tone: ToneLike<A>): void {
  if (tap) return
  const analyser = tone.getContext().createAnalyser()
  analyser.fftSize = FFT_SIZE
  const destination = tone.getDestination()
  destination.connect(analyser)
  tap = { analyser, disconnect: () => destination.disconnect(analyser), freq: new Uint8Array(analyser.frequencyBinCount), wave: new Uint8Array(analyser.fftSize) }
}

/** Fills `out` (length LEVEL_BANDS) with band averages from 0 to 255. False, and `out` untouched, until `attachLevels` has run. */
export function getLevels(out: Uint8Array): boolean {
  if (!tap) return false
  tap.analyser.getByteFrequencyData(tap.freq)
  out.set(bandsFrom(tap.freq, LEVEL_BANDS).subarray(0, out.length))
  return true
}

/** 0 to 1: the RMS of the sound as it is now. 0 until `attachLevels` has run. */
export function getLoudness(): number {
  if (!tap) return 0
  tap.analyser.getByteTimeDomainData(tap.wave)
  let sum = 0
  for (const sample of tap.wave) sum += ((sample - 128) / 128) ** 2
  return Math.min(1, Math.sqrt(sum / tap.wave.length))
}

export function detachLevels(): void {
  if (!tap) return
  tap.disconnect()
  tap = null
}
