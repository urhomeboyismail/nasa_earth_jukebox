// EIC06 T4: the ocean track's sound, on Tone.js (loaded on the first click or key press, on Tone's one shared AudioContext).
//
//   synth → low-pass filter → tremolo (the pulse) → chorus (the swirl) → panner → level → limiter (-1 dBFS) → speakers
//
// The Transport follows the video: its bpm is 120 × the playback rate, so one quarter note is one step (half a second of video),
// and a repeat on every quarter applies that step's numbers at the exact audio time. Every change ramps, so step jitter never clicks.

import { cutoffFor, pitchFor, pulseRateFor, stepAt, STEPS_PER_SECOND, swirlFor } from './mapping'
import type { OceanTrack } from './schema'

type ToneModule = typeof import('tone')

const LIMIT_DB = -1
/** The drone's own level, well under the limiter, so it rarely has to work. */
const SYNTH_DB = -12
const RAMP_S = 0.25
const LEVEL_RAMP_S = 0.3
/** Echo's callouts lower the music by about 9 dB. */
export const CALLOUT_DUCK_DB = -9
const BASE_BPM = 60 * STEPS_PER_SECOND

/** Explore mode's reading: null when explore is off, `silent` over a cell with no ocean. */
export type Probe = { sst: number; pan: number } | 'silent' | null

export type OceanSound = {
  /** Starts the Transport at a video time and rate. */
  play(mediaTime: number, rate: number): void
  pause(): void
  /** Moves the Transport to a video time and sounds that step at once. */
  seek(mediaTime: number): void
  setRate(rate: number): void
  /** Where the Transport is, in video seconds. */
  mediaTime(): number
  probe(next: Probe): void
  duck(on: boolean): void
  /** Sounds one step for `seconds` on its own (a "Hear" button). */
  preview(step: number, seconds: number): void
  dispose(): void
}

export function createOceanSound(t: ToneModule, track: OceanTrack): OceanSound {
  const { timeline, calibration } = track
  const transport = t.getTransport()
  const limiter = new t.Limiter(LIMIT_DB).toDestination()
  const level = new t.Gain(0).connect(limiter)
  const panner = new t.Panner(0).connect(level)
  const chorus = new t.Chorus(1.5, 3.5, 0.7).start().connect(panner)
  const tremolo = new t.Tremolo(1, 0.6).start().connect(chorus)
  const filter = new t.Filter(calibration.filter_cutoff_hz[0], 'lowpass').connect(tremolo)
  const synth = new t.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.3, release: 0.8 }, volume: SYNTH_DB }).connect(filter)

  let playing = false
  let probe: Probe = null
  let ducked = false
  let droneOn = false
  let step = 0
  let previewTimer: ReturnType<typeof setTimeout> | undefined

  transport.stop()
  transport.bpm.value = BASE_BPM
  transport.ticks = 0
  const repeat = transport.scheduleRepeat(time => {
    step = stepAt(transport.getTicksAtTime(time) / transport.PPQ / STEPS_PER_SECOND, timeline.length)
    apply(time)
  }, '4n', 0)

  /** Sets every parameter for the current step (and probe) at an audio time. */
  function apply(time = t.now()) {
    const metrics = timeline[step]?.metrics
    const sst = probe && probe !== 'silent' ? probe.sst : metrics?.sst_normalized
    if (sst !== undefined) {
      filter.frequency.rampTo(cutoffFor(sst, calibration.filter_cutoff_hz), RAMP_S, time)
      synth.frequency.rampTo(pitchFor(sst, calibration.pitch_range_hz), RAMP_S / 2, time)
    }
    if (metrics) {
      tremolo.frequency.rampTo(pulseRateFor(metrics.current_velocity_norm), RAMP_S, time)
      chorus.wet.rampTo(swirlFor(metrics.eddy_vorticity_norm), RAMP_S, time)
    }
    panner.pan.rampTo(probe && probe !== 'silent' ? probe.pan : 0, RAMP_S, time)
    const silent = probe === 'silent' || (!probe && !metrics)
    level.gain.rampTo(silent ? 0 : ducked ? 10 ** (CALLOUT_DUCK_DB / 20) : 1, LEVEL_RAMP_S, time)
  }

  /** The drone sounds while the video plays, while exploring, or during a preview. */
  function drone(on: boolean) {
    if (on === droneOn) return
    droneOn = on
    if (on) synth.triggerAttack(pitchFor(timeline[step]?.metrics?.sst_normalized ?? 0, calibration.pitch_range_hz))
    else synth.triggerRelease()
  }

  const toTicks = (mediaTime: number) => Math.max(0, Math.round(mediaTime * STEPS_PER_SECOND * transport.PPQ))

  return {
    play(mediaTime, rate) {
      clearTimeout(previewTimer)
      playing = true
      transport.bpm.value = BASE_BPM * rate
      transport.ticks = toTicks(mediaTime)
      step = stepAt(mediaTime, timeline.length)
      apply()
      drone(true)
      transport.start()
    },
    pause() {
      playing = false
      transport.pause()
      drone(probe !== null)
    },
    seek(mediaTime) {
      transport.ticks = toTicks(mediaTime)
      step = stepAt(mediaTime, timeline.length)
      apply()
    },
    setRate(rate) { transport.bpm.value = BASE_BPM * rate },
    mediaTime: () => transport.ticks / transport.PPQ / STEPS_PER_SECOND,
    probe(next) {
      probe = next
      apply()
      drone(playing || probe !== null)
    },
    duck(on) {
      ducked = on
      apply()
    },
    preview(index, seconds) {
      clearTimeout(previewTimer)
      step = Math.min(timeline.length - 1, Math.max(0, index))
      apply()
      drone(true)
      previewTimer = setTimeout(() => drone(playing || probe !== null), seconds * 1000)
    },
    dispose() {
      clearTimeout(previewTimer)
      transport.clear(repeat)
      transport.stop()
      transport.bpm.value = 120
      synth.triggerRelease()
      for (const node of [synth, filter, tremolo, chorus, panner, level, limiter]) node.dispose()
    },
  }
}

/** Loads Tone (the first time), starts the AudioContext and builds the sound. Call it from a click or key press. */
export async function loadOceanSound(track: OceanTrack): Promise<OceanSound> {
  const t = await import('tone')
  await t.start()
  return createOceanSound(t, track)
}
