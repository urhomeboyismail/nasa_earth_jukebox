// Recording an exploration (ticket IX08): a log of every date change and cursor move, with the time since the start. Pure; the panel feeds it.
// What is rendered is the date steps: a cursor move is logged (it is part of what the listener did) but the offline render, like the Listen
// page's frames, plays one music frame per date (src/features/playlist/renderSequence.ts), so a move within a date adds no sound to the file.

import { RENDER_MAX_SECONDS } from '../../sonify/schedule'

/** A recording stops by itself here. Under the ensemble's 180 s render limit, with room for the tail (the same bound SN12 uses). */
export const RECORD_LIMIT_S = RENDER_MAX_SECONDS
const LIMIT_MS = RECORD_LIMIT_S * 1000

export type RecordEvent =
  | { kind: 'date'; atMs: number; index: number }
  | { kind: 'cursor'; atMs: number; col: number; row: number }

/** `full` is true once the time limit was reached; nothing more is added. */
export type RecordLog = { events: readonly RecordEvent[]; full: boolean }

/** A log that starts on the date being shown. */
export const startLog = (index: number): RecordLog => ({ events: [{ kind: 'date', atMs: 0, index }], full: false })

function add(log: RecordLog, event: RecordEvent): RecordLog {
  if (log.full) return log
  if (event.atMs >= LIMIT_MS) return { ...log, full: true }
  const last = log.events[log.events.length - 1]
  // Time never goes backwards: an event stamped earlier than the last is placed at the last one's time.
  const atMs = Math.max(event.atMs, last ? last.atMs : 0)
  return { ...log, events: [...log.events, { ...event, atMs }] }
}

export const logDate = (log: RecordLog, index: number, atMs: number): RecordLog => add(log, { kind: 'date', atMs, index })
export const logCursor = (log: RecordLog, col: number, row: number, atMs: number): RecordLog => add(log, { kind: 'cursor', atMs, col, row })

/** The log is full when the clock passes the limit even if nothing happened. */
export const closeAt = (log: RecordLog, atMs: number): RecordLog => (atMs >= LIMIT_MS ? { ...log, full: true } : log)

export type RecordedStep = { index: number; atSeconds: number }

/** The dates heard, in time order: the steps the render plays. */
export function stepsFromLog(log: RecordLog): RecordedStep[] {
  return log.events
    .flatMap(event => (event.kind === 'date' ? [{ index: event.index, atSeconds: event.atMs / 1000 }] : []))
    .sort((a, b) => a.atSeconds - b.atSeconds)
}

/** "1 minute 20 seconds", "45 seconds", "1 second". */
export function durationWords(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(s / 60)
  const seconds = s % 60
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (minutes === 0) return part(seconds, 'second')
  return seconds === 0 ? part(minutes, 'minute') : `${part(minutes, 'minute')} ${part(seconds, 'second')}`
}

/** The visible status while recording. */
export const recordingStatus = (seconds: number): string => `Recording: ${durationWords(seconds)}.`

/** `<data set id>-<yyyymmdd>-<hhmmss>.wav`, from the id (never a title) and the time, in UTC. */
export function downloadName(dataId: string, when: Date): string {
  const iso = when.toISOString() // 2026-11-13T09:05:07.000Z
  return `${dataId}-${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}.wav`
}
