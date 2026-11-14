// The level of the sound that is playing now (UI08): a read-only tap on the ensemble's master output, for Echo's chest equaliser.
// The analyser it reads goes nowhere else, so having it changes nothing that is heard.

/** The analyser's settings: 128 bins, smoothed so the bars fall back gently instead of flickering. */
export const LEVEL_FFT_SIZE = 256
export const LEVEL_SMOOTHING = 0.8

let source: AnalyserNode | null = null
let bytes = new Uint8Array(0)

/** The graph hands over its analyser when it is built, and null when it is disposed. */
export function setLevelSource(node: AnalyserNode | null): void {
  source = node
  bytes = new Uint8Array(node ? node.frequencyBinCount : 0)
}

export function hasLevelSource(): boolean {
  return source !== null
}

/** The bin where each of `count` log-spaced bands starts, and one past the last (bin 0, the DC offset, is left out). Every band has at least one bin. */
function edges(count: number, bins: number): number[] {
  const out = [1]
  for (let i = 1; i <= count; i++) out.push(Math.max(out[i - 1] + 1, Math.round(bins ** (i / count))))
  return out
}

/** `count` levels from 0 to 1, low pitch first. All zeros when nothing is being tapped (nothing plays, or the sound is not on this page). */
export function readBands(count: number): number[] {
  const bands = new Array<number>(Math.max(0, Math.floor(count))).fill(0)
  if (!source || bands.length === 0 || bytes.length < 2) return bands
  source.getByteFrequencyData(bytes)
  const cut = edges(bands.length, bytes.length)
  for (let i = 0; i < bands.length; i++) {
    const from = Math.min(cut[i], bytes.length - 1)
    const to = Math.min(Math.max(cut[i + 1], from + 1), bytes.length)
    let sum = 0
    for (let bin = from; bin < to; bin++) sum += bytes[bin]
    bands[i] = sum / (to - from) / 255
  }
  return bands
}
