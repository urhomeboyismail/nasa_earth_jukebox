// Renders one data set to files (docs/PLAN.md §6.3, ticket SN12): its checked frames, through the same features, ruleset and ensemble graph that
// play live, into a WAV, a WebVTT caption file and a JSON sidecar. Nothing random and no time stamp, so rendering twice gives the same bytes.

import type { Visualization } from '../../data'
import { baseInput, baselineFor, defaultLoadPixels } from '../../analysis/video/input'
import type { Pixels } from '../../analysis/analyze'
import { extractFeatures, type FrameFeatures } from '../../analysis/features'
import { DROPOUT_SEED } from '../../audio/ensemble/constants'
import type { ScheduledFrame } from '../../audio/ensemble/types'
import { encodeWav } from '../../audio/wav'
import { presetFor, toMusicFrame } from '../../sonify'
import type { MusicFrame, Preset } from '../../sonify/types'
import { RENDER_DETAIL, RENDER_SAMPLE_RATE, RENDER_TAIL_SECONDS, buildSchedule, stepSecondsFor } from '../../sonify/schedule'
import { toSidecar } from '../../sonify/sidecar'
import { cueText, toVtt } from '../../sonify/vtt'

export type RenderOffline = (
  schedule: ScheduledFrame[],
  options: { detail: typeof RENDER_DETAIL; sampleRate: number; tailSeconds: number },
  preset: Preset,
) => Promise<[Float32Array, Float32Array]>

export type RenderDeps = {
  /** Reads a PNG (a frame or a baseline). Default: the app's reader. */
  loadPixels?: (url: string) => Promise<Pixels>
  /** Renders the schedule to two channels. Default: the ensemble's own offline render. */
  renderOffline?: RenderOffline
  /** Renders with this preset instead of the one the manifest names (art mode, ticket IX12). The ruleset and the mapping are the same either way. */
  preset?: Preset
}

export type RenderOutput = {
  id: string
  title: string
  /** `<id>.wav` */
  wav: Blob
  /** `<id>.vtt` */
  vtt: string
  /** `<id>.json` */
  sidecar: string
  /** Length of the WAV. */
  seconds: number
}

/** The ensemble loads Tone on first use, so Tone stays out of the first load. The ensemble is disposed once the file is made. */
const ensembleRender: RenderOffline = async (schedule, options, preset) => {
  const { createEnsemble } = await import('../../audio/ensemble')
  const ensemble = createEnsemble(preset, { detail: options.detail })
  try {
    return await ensemble.renderOffline(schedule, options)
  } finally {
    ensemble.dispose()
  }
}

export async function renderSequence(visualization: Visualization, deps: RenderDeps = {}): Promise<RenderOutput> {
  const loadPixels = deps.loadPixels ?? defaultLoadPixels
  const renderOffline = deps.renderOffline ?? ensembleRender
  const frames = [...visualization.frames].sort((a, b) => a.date.localeCompare(b.date))
  if (frames.length === 0) throw new Error('This data set has no frames to render.')
  const preset = deps.preset ?? presetFor(visualization.sonification?.preset ?? 'major')

  // 1 and 2. Features, then music, one frame after another so each carries the last one's state.
  const allFeatures: FrameFeatures[] = []
  const music: MusicFrame[] = []
  let previousFeatures: FrameFeatures | undefined
  let previousMusic: MusicFrame | null = null
  for (const frame of frames) {
    let features: FrameFeatures
    try {
      const [pixels, baseline] = await Promise.all([loadPixels(frame.image), baselineFor(visualization, frame.date, loadPixels)])
      features = extractFeatures(pixels, { ...baseInput(visualization, frame.id, frame.date, 1), baseline }, previousFeatures)
    } catch (error) {
      throw new Error(`The picture for ${frame.date} could not be read. ${error instanceof Error ? error.message : String(error)}`)
    }
    const musicFrame = toMusicFrame(features, preset, previousMusic)
    allFeatures.push(features)
    music.push(musicFrame)
    previousFeatures = features
    previousMusic = musicFrame
  }

  // 3. Schedule, 4. render and encode.
  const stepSeconds = stepSecondsFor(frames.length)
  const schedule = buildSchedule(music, stepSeconds)
  const [left, right] = await renderOffline(schedule, { detail: RENDER_DETAIL, sampleRate: RENDER_SAMPLE_RATE, tailSeconds: RENDER_TAIL_SECONDS }, preset)
  const wav = encodeWav([left, right], RENDER_SAMPLE_RATE)

  // 5. Captions, 6. sidecar.
  const vtt = toVtt(schedule.map(({ frame, atSeconds }) => ({ id: frame.frameId, startSeconds: atSeconds, endSeconds: atSeconds + stepSeconds, text: cueText(frame) })))
  const sidecar = toSidecar({
    id: visualization.id,
    title: visualization.title,
    preset: preset.id,
    detail: RENDER_DETAIL,
    sampleRate: RENDER_SAMPLE_RATE,
    stepSeconds,
    dropoutSeed: DROPOUT_SEED,
    frames: schedule.map(({ frame, atSeconds }, i) => ({
      frameId: frame.frameId,
      date: frame.date,
      atSeconds,
      confidence: allFeatures[i].confidence,
      dropout: frame.dropout,
      missing: frame.missing,
      summary: frame.summary,
      hotspotIds: allFeatures[i].hotspots.map(spot => spot.id),
    })),
  })

  // 7. Output.
  return { id: visualization.id, title: visualization.title, wav, vtt, sidecar, seconds: left.length / RENDER_SAMPLE_RATE }
}
