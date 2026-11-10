// The date grid of a data set's video (SN05, docs/PLAN.md §6.3): video frame n shows the date `firstFrameDate + n × frameStepDays`.
// Pure, whole days only. Dates are plain YYYY-MM-DD and are read as UTC, as in src/dates.ts, so they are the same in every time zone.

import type { VideoSpec } from './types'

const DAY_MS = 86_400_000

/** Days since 1970-01-01 for a YYYY-MM-DD date, or null when it is not a real date (for example 2024-02-30). */
export function dayNumber(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const ms = Date.UTC(year, month - 1, day)
  const back = new Date(ms)
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) return null
  return ms / DAY_MS
}

const isoOfDay = (days: number) => new Date(days * DAY_MS).toISOString().slice(0, 10)

/** The date shown in video frame `index` (0-based). index may be any whole number of 0 or more. */
export function dateOfVideoFrame(video: VideoSpec, index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new RangeError(`video frame index must be a whole number of 0 or more, not ${index}`)
  const first = dayNumber(video.firstFrameDate)
  if (first === null) throw new RangeError(`the video's firstFrameDate ${video.firstFrameDate} is not a real date`)
  return isoOfDay(first + index * video.frameStepDays)
}

/** The video frame index that shows `date`, or null when that date is not on the video's grid (off a step, or before the first frame). */
export function videoFrameOf(video: VideoSpec, date: string): number | null {
  const [first, day] = [dayNumber(video.firstFrameDate), dayNumber(date)]
  if (first === null || day === null || !Number.isInteger(video.frameStepDays) || video.frameStepDays < 1) return null
  const offset = day - first
  if (offset < 0 || offset % video.frameStepDays !== 0) return null
  return offset / video.frameStepDays
}
