// Seeded randomness for the ensemble (ticket SN19): the same seed gives the same numbers on every machine, so the sound renders the same every time.
// The dropout cue (dropout.ts) and the room's impulse (graph.ts) draw from here; nothing in the ensemble calls Math.random.

/** A small seeded generator: the same seed gives the same numbers, on every machine. Each call returns a number from 0 to 1. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type ImpulseShape = {
  /** How long the tail rings. */
  seconds: number
  /** How far it has fallen by its end (60 is the usual reverb time). */
  decayDb: number
  /** 0 to 1: the share of each new sample a one-pole low-pass lets through. Lower is darker and warmer. */
  damping: number
}

/**
 * A room's impulse response: two channels of seeded noise, low-passed and falling exponentially by `decayDb` over `seconds`. The two channels draw
 * from the generator in turn, so they differ (a wide room) but stay the same for the same seed. The convolver normalises it, so its level is free.
 */
export function reverbImpulse(seed: number, sampleRate: number, shape: ImpulseShape): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const length = Math.max(1, Math.round(shape.seconds * sampleRate))
  const next = mulberry32(seed)
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  // Amplitude falls by decayDb over the whole length: 10^(−decayDb / 20) at the end.
  const fall = Math.log(10) * shape.decayDb / 20 / length
  let lowLeft = 0
  let lowRight = 0
  for (let i = 0; i < length; i++) {
    lowLeft += shape.damping * (next() * 2 - 1 - lowLeft)
    lowRight += shape.damping * (next() * 2 - 1 - lowRight)
    const envelope = Math.exp(-fall * i)
    left[i] = lowLeft * envelope
    right[i] = lowRight * envelope
  }
  return [left, right]
}
