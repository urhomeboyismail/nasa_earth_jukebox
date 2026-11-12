// The ensemble engine (docs/PLAN.md §6.3, ticket SN04): seven voices into one master bus with a compressor and a −1 dBFS limiter, a lifecycle a
// listener can trust, and the same graph rendered offline for the WAV export. A second engine, separate from src/audio/engine.ts, which stays
// as the Simple mode. Tone is loaded on start(), which has to happen in a click or key press anyway (WCAG 1.4.2), so it stays out of the first load.

import type { DetailLevel, MusicFrame, Preset, VoiceId } from '../../sonify/types'
import { duck } from '../duck'
import { MAX_RENDER_S, PAUSE_FADE_S, RENDER_TAIL_S, RESUME_FADE_S, STOP_FADE_S, VOLUME_RAMP_S } from './constants'
import { buildGraph, type Graph } from './graph'
import { createStatus, watchContext, watchVisibility } from './lifecycle'
import { createPlayer, type Player } from './voices'
import type { Ensemble, EnsembleOptions, HeldTone, NoteEvent, ScheduledFrame } from './types'

export type { Ensemble, EnsembleOptions, EnsembleStatus, HeldTone, NoteEvent, ScheduledFrame } from './types'
export { planFrame } from './plan'
export { dropoutTaps } from './dropout'
export * from './constants'

type ToneModule = typeof import('tone')

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const DEFAULT_SAMPLE_RATE = 44100

export function createEnsemble(preset: Preset, options: EnsembleOptions = {}): Ensemble {
  const spatial = options.spatial ?? 'stereo'
  let detail: DetailLevel = options.detail ?? 'full'
  let volume = clamp01(options.volume ?? 1)
  /** The duck controller's target (1, or DUCK_LINEAR). The master's level while sounding is volume × this. */
  let duckGain = duck.target()
  const level = () => volume * duckGain
  let soloed: VoiceId | null = null
  const muted = new Set<VoiceId>()
  const status = createStatus()

  let tone: ToneModule | null = null
  let graph: Graph | null = null
  let player: Player | null = null
  let raw: BaseAudioContext | null = null
  let removeListeners: (() => void) | null = null
  let starting: Promise<void> | null = null
  let disposed = false

  /** Built once, on the first start(): the graph, the player and the two listeners. */
  function build(t: ToneModule) {
    graph = buildGraph(t, { master: 0, spatial })
    raw = t.getContext().rawContext
    const context = raw
    player = createPlayer({ t, graph, preset, clock: () => context.currentTime, canSound: () => status.get() === 'on' })
    player.setDetail(detail)
    player.setSolo(soloed)
    for (const voice of muted) player.setMuted(voice, true)

    const stopContext = watchContext(context, state => {
      // The browser took the sound away. Only start(), from a click, brings it back.
      if (state !== 'running' && status.get() === 'on') status.set('suspended')
    })
    const stopVisibility = watchVisibility(
      () => {
        if (status.get() === 'on') pause()
      },
      () => {
        // Coming back to the page never resumes the sound. If the browser suspended the context meanwhile, say so.
        if (status.get() === 'paused' && context.state !== 'running') status.set('suspended')
      },
    )
    // A voice speaking lowers the master and lets it back; a paused or stopped ensemble stays at 0 and resumes at the current target.
    const stopDuck = duck.subscribe((gain, rampS) => {
      duckGain = gain
      if (rampS > 0 && graph && status.get() === 'on') graph.master.gain.rampTo(level(), rampS)
    })
    removeListeners = () => {
      stopContext()
      stopVisibility()
      stopDuck()
    }
  }

  async function run() {
    const t = (tone ??= await import('tone'))
    await t.start()
    if (disposed) return
    if (!graph) build(t)
    graph!.master.gain.rampTo(level(), RESUME_FADE_S)
    t.getTransport().start()
    status.set(raw!.state === 'running' ? 'on' : 'suspended')
  }

  function start(): Promise<void> {
    if (disposed) return Promise.resolve()
    starting ??= run().finally(() => {
      starting = null
    })
    return starting
  }

  function stop() {
    if (disposed || !graph || !player || !raw) return
    const transport = tone!.getTransport()
    player.releaseAll(raw.currentTime)
    graph.master.gain.rampTo(0, STOP_FADE_S)
    transport.stop()
    player.reset()
    status.set('off')
  }

  function pause() {
    if (disposed || !graph || !player || !raw || status.get() !== 'on') return
    const end = raw.currentTime + PAUSE_FADE_S
    graph.master.gain.rampTo(0, PAUSE_FADE_S)
    tone!.getTransport().pause(end)
    player.releaseAll(end)
    status.set('paused')
  }

  function resume() {
    if (disposed || !graph || !raw || status.get() !== 'paused') return
    if (raw.state !== 'running') {
      status.set('suspended')
      return
    }
    tone!.getTransport().start()
    graph.master.gain.rampTo(level(), RESUME_FADE_S)
    status.set('on')
  }

  async function renderOffline(schedule: ScheduledFrame[], opts: { detail: DetailLevel; sampleRate?: number; tailSeconds?: number }): Promise<[Float32Array, Float32Array]> {
    if (disposed) throw new Error('This ensemble has been disposed.')
    if (!schedule.length) throw new Error('There is nothing to render yet.')
    const sorted = [...schedule].sort((a, b) => a.atSeconds - b.atSeconds)
    const seconds = sorted[sorted.length - 1].atSeconds + (opts.tailSeconds ?? RENDER_TAIL_S)
    if (seconds > MAX_RENDER_S) throw new Error('That is too long to render (over 3 minutes).')
    const t = (tone ??= await import('tone'))
    // A graph of its own on the offline context, at full level whatever the listening volume is: the file is played on the listener's own volume.
    const buffer = await t.Offline(() => {
      const offlineGraph = buildGraph(t, { master: 1, spatial })
      const offlinePlayer = createPlayer({ t, graph: offlineGraph, preset, clock: () => 0, canSound: () => true })
      offlinePlayer.setDetail(opts.detail)
      for (const { frame, atSeconds } of sorted) offlinePlayer.apply(frame, atSeconds)
      t.getTransport().start(0)
    }, seconds, 2, opts.sampleRate ?? DEFAULT_SAMPLE_RATE)
    return [Float32Array.from(buffer.getChannelData(0)), Float32Array.from(buffer.getChannelData(1))]
  }

  return {
    start,
    stop,
    pause,
    resume,
    apply(frame: MusicFrame, atTime?: number) { if (!disposed) player?.apply(frame, atTime) },
    hold(tone: HeldTone | null, atTime?: number) { if (!disposed) player?.hold(tone, atTime) },
    playNotes(notes: NoteEvent[], atTime?: number) { if (!disposed) player?.playNotes(notes, atTime) },
    playDropout(atTime?: number) { if (!disposed) player?.playDropout(atTime) },
    solo(voice: VoiceId | null) {
      if (disposed) return
      soloed = voice
      player?.setSolo(voice)
    },
    mute(voice: VoiceId, isMuted: boolean) {
      if (disposed) return
      if (isMuted) muted.add(voice)
      else muted.delete(voice)
      player?.setMuted(voice, isMuted)
    },
    setDetail(level: DetailLevel) {
      if (disposed) return
      detail = level
      player?.setDetail(level)
    },
    setVolume(zeroToOne: number) {
      if (disposed) return
      volume = clamp01(zeroToOne)
      if (graph && status.get() === 'on') graph.master.gain.rampTo(level(), VOLUME_RAMP_S)
    },
    status: () => status.get(),
    now: () => raw?.currentTime ?? 0,
    onStatus: listener => status.subscribe(listener),
    dispose() {
      if (disposed) return
      disposed = true
      removeListeners?.()
      if (player && raw) {
        player.releaseAll(raw.currentTime)
        player.reset()
      }
      graph?.dispose()
      graph = null
      player = null
      status.set('off')
      status.clear()
    },
    renderOffline,
  }
}
