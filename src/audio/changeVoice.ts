// The pure part of the "change" sound style (docs/PLAN.md §6.2): what the change bed and the contour voice should do, as numbers.
// No Tone and no clock here, so the same input always gives the same answer and tests need no audio.

import { Note } from 'tonal'
import type { Contour } from '../analysis/types'
import { elevationForPoint, panForPoint } from './pan'

/**
 * What the "change" style needs from a data set's mapping, on top of `SoundMapping`: a note for each change step and for each contour
 * level. They are optional, so a data set with no baseline still sounds. A data set's `SoundMapping` (src/data/types.ts) fits this.
 */
export type ChangeSounds = {
  changeSteps?: { id: string; range: [number, number]; note: string }[]
  contourLevels?: { value: number; note: string }[]
}

/** The change bed sits in C3 to C4 (PLAN.md §6.2). A contour level's note sits between C3 and C6. */
export const BED_LOWEST = 'C3'
export const BED_HIGHEST = 'C4'
export const CONTOUR_LOWEST = 'C3'
export const CONTOUR_HIGHEST = 'C6'

/** Each step opens the filter this much wider than the one below it (in multiples of the fundamental), so brightness rises strictly with the step. */
const STEP_BRIGHTNESS = 1.5
/** Brightness at the bottom step: three times the fundamental, so the filter never touches the pitch heard (as in T105). */
const MIN_CUTOFF_RATIO = 3
/** Inside a step, the change moves the cutoff up by at most this share. It must stay below STEP_BRIGHTNESS - 1, or one step could be as bright as the next. */
const WITHIN_STEP = 0.25
const MAX_CUTOFF_HZ = 12000

/** The quiet sawtooth that gives the bed something for the filter to open on, relative to the sine. */
export const SAW_SHARE = 0.25
const FILTER_Q = 1

export type Bed = { note: string; cutoffHz: number; gainDb: number }

function frequency(note: string): number {
  const f = Note.freq(note)
  if (f === null) throw new Error(`"${note}" is not a note name.`)
  return f
}

/** Where `value` sits inside `range`, 0 to 1. A range that is not finite (an open-ended step) or a missing value gives the middle. */
function positionIn(value: number | undefined, range: [number, number]): number {
  const [low, high] = range
  if (value === undefined || !Number.isFinite(value) || !Number.isFinite(low) || !Number.isFinite(high) || high <= low) return 0.5
  return Math.min(1, Math.max(0, (value - low) / (high - low)))
}

/** The low-pass filter's cutoff for a step: always at least three times the fundamental, strictly higher for every higher step. */
export function cutoffFor(fundamentalHz: number, stepIndex: number, position = 0.5): number {
  const ratio = MIN_CUTOFF_RATIO * STEP_BRIGHTNESS ** stepIndex * (1 + WITHIN_STEP * position)
  return Math.min(MAX_CUTOFF_HZ, fundamentalHz * ratio)
}

/**
 * Relative power of the bed after the filter: a sine plus a sawtooth at `SAW_SHARE`, through a 2nd-order low-pass. It stands in for a
 * measurement so `bedFor` can level the steps; the offline measurement in docs/performance.md checks it against the real voice.
 */
export function bedPower(fundamentalHz: number, cutoffHz: number): number {
  const response = (hz: number) => {
    const r = hz / cutoffHz
    return 1 / Math.sqrt((1 - r * r) ** 2 + (r / FILTER_Q) ** 2)
  }
  let power = 0.5 * response(fundamentalHz) ** 2
  for (let n = 1; n * fundamentalHz < 20000; n++) {
    const amplitude = (SAW_SHARE * 2) / (Math.PI * n)
    power += 0.5 * (amplitude * response(n * fundamentalHz)) ** 2
  }
  return power
}

/**
 * The bed for one change step (PLAN.md §6.2): `note` is the step's own note, so pitch steps with the change; the cutoff rises with the
 * step and a little with `medianChange` inside it; `gainDb` is lower the brighter the filter is, so every step has the same loudness
 * and a warmer step is never louder. `stepRange` is the step's `[low, high]`; a step with an open end gets the middle cutoff.
 */
export function bedFor(stepIndex: number, stepCount: number, medianChange: number | undefined, stepRange: [number, number], note: string): Bed {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= stepCount) throw new Error(`Step ${stepIndex} is not one of ${stepCount} change steps.`)
  const fundamental = frequency(note)
  const cutoffHz = cutoffFor(fundamental, stepIndex, positionIn(medianChange, stepRange))
  // Level against the quietest case, the bottom of the bottom step, so no step is ever louder than that one.
  const reference = bedPower(fundamental, cutoffFor(fundamental, 0, 0))
  const gainDb = -10 * Math.log10(bedPower(fundamental, cutoffHz) / reference)
  return { note, cutoffHz, gainDb: Math.min(0, gainDb) }
}

/** A step's index in the data set's change steps, or -1. */
export function stepIndexOf(changeSteps: NonNullable<ChangeSounds['changeSteps']>, id: string): number {
  return changeSteps.findIndex(step => step.id === id)
}

/** Seconds a contour takes: its length times `secondsPerUnit` (a unit is the width of the image), no shorter than 2 s and no longer than 8 s. */
export const MIN_TRACE_MS = 2000
export const MAX_TRACE_MS = 8000
/** A turn sharper than this (45°) is an accent, and accents are at least this far apart: at most 8 a second. */
export const ACCENT_TURN = Math.PI / 4
export const ACCENT_GAP_MS = 125
/** How long a hiss at a broken end lasts. */
export const END_HISS_MS = 150

export type ContourEvent = {
  /** From the start of the trace. */
  atMs: number
  index: number
  /** -1 (west) to +1 (east), from x. */
  pan: number
  /** -1 (south) to +1 (north), from y; heard in 3D mode only. */
  elevation: number
  /** The voice's filter: brighter where the front is steeper, never below three times the note. */
  cutoffHz: number
  /** A sharp turn here: a soft click. */
  accent: boolean
  /** The line stops here at a cell with no data: a short hiss. */
  hiss: boolean
}

/** Front steepness, in variable units per cell, at which the voice is fully open. */
const FRONT_OPEN = 2
const CONTOUR_MAX_RATIO = 12

/** The length of the line in image units (1 = the width of the image), counting the closing segment of a closed line. */
function lengthOf(contour: Contour): number {
  const { points, closed } = contour
  let length = 0
  for (let k = 1; k < points.length; k++) length += Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y)
  if (closed && points.length > 1) length += Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y)
  return length
}

/** Where along the line the accents fall: the sharpest point of each run of sharp turns, then no two closer than `ACCENT_GAP_MS`. */
function accentIndexes(contour: Contour, atMs: number[]): Set<number> {
  const runs: number[] = []
  let best = -1
  contour.points.forEach((point, k) => {
    if (Math.abs(point.turn) > ACCENT_TURN) {
      if (best === -1 || Math.abs(point.turn) > Math.abs(contour.points[best].turn)) best = k
    } else if (best !== -1) {
      runs.push(best)
      best = -1
    }
  })
  if (best !== -1) runs.push(best)
  const accents = new Set<number>()
  let last = -Infinity
  for (const k of runs) {
    if (atMs[k] - last >= ACCENT_GAP_MS) {
      accents.add(k)
      last = atMs[k]
    }
  }
  return accents
}

/**
 * The contour voice along one line (PLAN.md §6.2): one event per point, at a steady speed along the line. `msPerUnit` is how long the
 * whole width of the image would take, so the trace is as long as the line is. Pure: the same line always gives the same events.
 */
export function contourEvents(contour: Contour, note: string, msPerUnit: number): { durationMs: number; events: ContourEvent[] } {
  const fundamental = frequency(note)
  const { points } = contour
  if (!points.length) return { durationMs: 0, events: [] }
  const rawMs = lengthOf(contour) * msPerUnit
  const durationMs = Math.min(MAX_TRACE_MS, Math.max(MIN_TRACE_MS, Number.isFinite(rawMs) ? rawMs : MIN_TRACE_MS))

  // Time follows the distance along the line, so the voice moves at a steady speed; a line with no length falls back to even spacing.
  const distance = [0]
  for (let k = 1; k < points.length; k++) distance.push(distance[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y))
  const total = distance[distance.length - 1]
  const atMs = points.map((_, k) => Math.round((total > 0 ? distance[k] / total : points.length > 1 ? k / (points.length - 1) : 0) * durationMs))

  const accents = accentIndexes(contour, atMs)
  const events = points.map((point, k): ContourEvent => {
    const open = Math.min(1, Math.max(0, Number.isFinite(point.front) ? point.front / FRONT_OPEN : 0))
    return {
      atMs: atMs[k],
      index: k,
      pan: panForPoint(point.x),
      elevation: elevationForPoint(point.y),
      cutoffHz: Math.min(MAX_CUTOFF_HZ, fundamental * (MIN_CUTOFF_RATIO + (CONTOUR_MAX_RATIO - MIN_CUTOFF_RATIO) * open)),
      accent: accents.has(k),
      hiss: (k === 0 && contour.brokenStart) || (k === points.length - 1 && contour.brokenEnd),
    }
  })
  return { durationMs, events }
}
