// The JSON that goes with a rendered WAV (docs/PLAN.md §6.3, ticket SN12): which date is at which second, and what its music was.
// No time stamp, host name or random id, so the same data set always gives the same text. Pure.

import type { DetailLevel } from './types'

export type SidecarFrame = {
  frameId: string
  date: string
  atSeconds: number
  confidence: number
  dropout: boolean
  /** Voices with no data this frame. */
  missing: string[]
  summary: string
  /** The tracked hot-spot ids, which the marker and event words use. */
  hotspotIds: string[]
}

export type SidecarInput = {
  id: string
  title: string
  preset: string
  detail: DetailLevel
  sampleRate: number
  stepSeconds: number
  dropoutSeed: number
  frames: SidecarFrame[]
}

const round = (value: number, places: number) => Number(value.toFixed(places))

export function toSidecar(input: SidecarInput): string {
  const body = {
    id: input.id,
    title: input.title,
    preset: input.preset,
    detail: input.detail,
    sampleRate: input.sampleRate,
    stepSeconds: round(input.stepSeconds, 6),
    dropoutSeed: input.dropoutSeed,
    frames: input.frames.map(frame => ({
      frameId: frame.frameId,
      date: frame.date,
      atSeconds: round(frame.atSeconds, 3),
      confidence: round(frame.confidence, 3),
      dropout: frame.dropout,
      missing: [...frame.missing],
      summary: frame.summary,
      hotspotIds: [...frame.hotspotIds],
    })),
  }
  return `${JSON.stringify(body, null, 2)}\n`
}
