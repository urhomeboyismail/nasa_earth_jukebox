// A data set's timbre (ticket SN14): the manifest's optional `sonification.timbre`, resolved once into what the graph and the player need.
// Without it every value is the default and the voices sound exactly as before (the goldens hold this). Pure: the same spec gives the same numbers.

import type { TimbreSpec } from '../../data/types'
import type { Waveform } from '../../sonify/types'

export type FilterRange = { low: number; high: number }
export type Timbre = {
  /** Every pitched voice gets an FM oscillator of its usual waveform (Tone's 'fmtriangle' and so on): no new node, nothing random. */
  fm: boolean
  /** The low-pass range brightness moves through; null keeps each voice's own range. */
  filterHz: FilterRange | null
  exponential: boolean
  /** 0 to 1: how far from the centre the voices are placed. */
  panWidth: number
}

export const DEFAULT_TIMBRE: Timbre = { fm: false, filterHz: null, exponential: false, panWidth: 1 }

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

export function resolveTimbre(spec?: TimbreSpec): Timbre {
  if (!spec) return DEFAULT_TIMBRE
  return {
    fm: spec.instrument === 'fm',
    filterHz: spec.filterHz ?? null,
    exponential: spec.curve === 'exponential',
    panWidth: clamp01(spec.panWidth ?? 1),
  }
}

/** The cutoff for a brightness of 0 to 1: a straight line from low to high, or, exponential, low × (high / low)^brightness, which sounds even. */
export function cutoff(range: FilterRange, brightness: number, exponential: boolean): number {
  const b = clamp01(brightness)
  return exponential ? range.low * (range.high / range.low) ** b : range.low + (range.high - range.low) * b
}

export function oscillatorFor(type: Waveform, fm: boolean): Waveform | `fm${Waveform}` {
  return fm ? `fm${type}` : type
}
