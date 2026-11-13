// The WAV of a recorded exploration (ticket IX08), through SN12's render: the same features, ruleset and ensemble graph that play live.
// renderSequence builds one music frame per date in date order; here the schedule is replaced by the dates the listener heard, at the times
// they heard them, and the same ensemble renders that.

import type { Visualization } from '../../data'
import type { ScheduledFrame } from '../../audio/ensemble/types'
import { RENDER_DETAIL, RENDER_SAMPLE_RATE, RENDER_TAIL_SECONDS } from '../../sonify/schedule'
import { renderSequence, type RenderDeps, type RenderOffline } from '../playlist/renderSequence'
import { stepsFromLog, type RecordLog } from './record'

/** The ensemble loads Tone on first use, so Tone stays out of the first load. It is disposed once the file is made. */
const ensembleRender: RenderOffline = async (schedule, options, preset) => {
  const { createEnsemble } = await import('../../audio/ensemble')
  const ensemble = createEnsemble(preset, { detail: options.detail })
  try {
    return await ensemble.renderOffline(schedule, options)
  } finally {
    ensemble.dispose()
  }
}

/**
 * The schedule for a log: each recorded date's music frame at its recorded time. `byDate` is renderSequence's schedule, which is in date
 * order, so a frame's place in it is its place among the data set's dates sorted.
 */
export function recordedSchedule(visualization: Visualization, log: RecordLog, byDate: readonly ScheduledFrame[]): ScheduledFrame[] {
  const sorted = visualization.frames.map(frame => frame.date).sort((a, b) => a.localeCompare(b))
  return stepsFromLog(log).flatMap(({ index, atSeconds }) => {
    const date = visualization.frames[index]?.date
    const entry = date === undefined ? undefined : byDate[sorted.indexOf(date)]
    return entry ? [{ frame: entry.frame, atSeconds }] : []
  })
}

export async function renderRecording(visualization: Visualization, log: RecordLog, deps: RenderDeps = {}): Promise<Blob> {
  if (stepsFromLog(log).length === 0) throw new Error('There is nothing recorded to render.')
  const renderOffline = deps.renderOffline ?? ensembleRender
  const { wav } = await renderSequence(visualization, {
    ...deps,
    renderOffline: (byDate, options, preset) =>
      renderOffline(recordedSchedule(visualization, log, byDate), { ...options, detail: RENDER_DETAIL, sampleRate: RENDER_SAMPLE_RATE, tailSeconds: RENDER_TAIL_SECONDS }, preset),
  })
  return wav
}
