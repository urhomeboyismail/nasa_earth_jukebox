// Sends a frame's plan to the voices (docs/PLAN.md §6.3, ticket SN04). `planFrame` decides what sounds; this file only does it: one function per voice,
// each setting its voice for the frame's own time. It works on whatever audio context the graph was built in (the live one, or the offline one
// in renderOffline), so the live sound and the exported sound come from the same code.
//
// The Tone Transport is shared with the old engine (src/audio/engine.ts), so this file only ever clears the events it scheduled itself.

import type { DetailLevel, MusicFrame, Preset, VoiceId } from '../../sonify/types'
import { aimPanner } from '../pan'
import {
  ACCENT_DB, CLICK_S, DROPOUT_SEED, DROPOUT_TAP_S, GLIDE_S, HOLD_FILTER_HZ, INTERACTIVE_LOOKAHEAD_S, MIN_APPLY_GAP_S, MOTION_FILTER_HZ, MOTION_PAD_MIDI, PARAM_RAMP_S,
  RHYTHM_NOTE_SHARE, SCAN_VOICES, VOICE_GAIN_DB,
} from './constants'
import { dropoutTaps } from './dropout'
import type { Graph } from './graph'
import { midiToHz, planFrame, type VoiceAction } from './plan'
import { TIME_PULSE_MIDI } from '../../sonify/ranges'
import { cutoff, DEFAULT_TIMBRE, type Timbre } from './timbre'
import type { HeldTone, NoteEvent } from './types'

type ToneModule = typeof import('tone')
type Gain = InstanceType<ToneModule['Gain']>

export type PlayerContext = {
  t: ToneModule
  graph: Graph
  preset: Preset
  /** The audio clock in seconds. */
  clock: () => number
  /** Whether the player may make sound now: live, only while the ensemble is on; offline, always. */
  canSound: () => boolean
  /** The data set's timbre (SN14); absent is the default, today's sound. */
  timbre?: Timbre
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

export function createPlayer(ctx: PlayerContext) {
  const { t, graph, preset } = ctx
  const timbre = ctx.timbre ?? DEFAULT_TIMBRE
  const holdHz = (brightness: number) => cutoff(timbre.filterHz ?? HOLD_FILTER_HZ, brightness, timbre.exponential)
  const motionHz = (brightness: number) => cutoff(timbre.filterHz ?? MOTION_FILTER_HZ, brightness, timbre.exponential)
  const wide = (pan: number) => pan * timbre.panWidth
  const transport = t.getTransport()

  let detail: DetailLevel = 'full'
  let solo: VoiceId | null = null
  const muted = new Set<VoiceId>()

  let lastAt: number | null = null
  let lastFrame: MusicFrame | null = null
  let wasDropout = false
  let melodyMidi: number | null = null
  let harmonyKey: string | null = null
  let bassMidi: number | null = null
  const slots: ({ id: string; midi: number } | null)[] = graph.hotspots.map(() => null)
  let rhythmIds: number[] = []
  let motionOn = false
  let pulse: { bpm: number; id: number } | null = null
  let accent: 'none' | 'month' | 'year' = 'none'
  let holdMidi: number | null = null

  const defaultTime = () => ctx.clock() + INTERACTIVE_LOOKAHEAD_S
  /** An audio-clock time as a Transport time. Offline, both start at 0. */
  const toTransport = (at: number) => transport.seconds + Math.max(0, at - ctx.clock())
  const setLevel = (node: Gain, value: number, at: number) => node.gain.rampTo(value, PARAM_RAMP_S, at)

  function clearRhythm() {
    for (const id of rhythmIds) transport.clear(id)
    rhythmIds = []
  }

  function stopPulse() {
    if (!pulse) return
    transport.clear(pulse.id)
    pulse = null
  }

  /** The time voice's click. A pending month or year accent is used once. */
  function click(time: number) {
    const { synth } = graph.time
    synth.volume.setValueAtTime(VOICE_GAIN_DB.time + (accent === 'none' ? 0 : ACCENT_DB), time)
    synth.triggerAttackRelease(midiToHz(TIME_PULSE_MIDI + (accent === 'year' ? 12 : 0)), CLICK_S, time)
    accent = 'none'
  }

  function act(a: VoiceAction, frame: MusicFrame, at: number) {
    switch (a.voice) {
      case 'melody': {
        const { synth, out } = graph.melody
        setLevel(out, a.level, at)
        if (!a.sounding) {
          if (melodyMidi !== null) synth.triggerRelease(at)
          melodyMidi = null
          return
        }
        const midi = a.midis[0]
        if (midi === melodyMidi) return
        // A note that slides keeps the voice sounding; any other new note is struck again.
        const slide = a.glide && melodyMidi !== null
        synth.portamento = slide ? GLIDE_S : 0
        if (slide) synth.setNote(midiToHz(midi), at)
        else synth.triggerAttack(midiToHz(midi), at)
        melodyMidi = midi
        return
      }
      case 'harmony': {
        const { synths, out } = graph.harmony
        setLevel(out, a.level, at)
        if (!a.sounding) {
          if (harmonyKey !== null) for (const synth of synths) synth.triggerRelease(at)
          harmonyKey = null
          return
        }
        // The chord is struck again only when its notes change; otherwise only its level moves. One plain synth for each note.
        const key = a.midis.join(',')
        if (key === harmonyKey) return
        synths.forEach((synth, i) => {
          if (i < a.midis.length) synth.triggerAttack(midiToHz(a.midis[i]), at)
          else synth.triggerRelease(at)
        })
        harmonyKey = key
        return
      }
      case 'bass': {
        const { synth, out } = graph.bass
        setLevel(out, a.level, at)
        if (!a.sounding) {
          if (bassMidi !== null) synth.triggerRelease(at)
          bassMidi = null
          return
        }
        if (a.midis[0] === bassMidi) return
        synth.triggerAttack(midiToHz(a.midis[0]), at)
        bassMidi = a.midis[0]
        return
      }
      case 'hotspots': {
        const slot = graph.hotspots[a.slot]
        setLevel(slot.out, a.level, at)
        if (!a.sounding) {
          if (slots[a.slot]) slot.synth.triggerRelease(at)
          slots[a.slot] = null
          return
        }
        aimPanner(slot.panner, wide(a.pan), a.elevation, at)
        slot.filter.frequency.rampTo(holdHz(a.brightness), PARAM_RAMP_S, at)
        const held = slots[a.slot]
        const midi = a.midis[0]
        // A slot that keeps following the same spot slides to the spot's new note.
        if (!held || held.midi !== midi) {
          if (held && held.id === a.id) slot.synth.setNote(midiToHz(midi), at)
          else slot.synth.triggerAttack(midiToHz(midi), at)
        }
        slots[a.slot] = { id: a.id ?? '', midi }
        return
      }
      case 'rhythm': {
        // The notes the last frame scheduled for the next two beats are replaced, not added to.
        clearRhythm()
        setLevel(graph.rhythm.out, a.level, at)
        if (!a.sounding || !a.midis.length) return
        aimPanner(graph.rhythm.panner, wide(a.pan), 0, at)
        const perBeat = a.perBeat ?? 1
        const gap = 60 / frame.time.pulseBpm / perBeat
        const start = toTransport(at)
        for (let i = 0; i < perBeat * 2; i++) {
          const hz = midiToHz(a.midis[i % a.midis.length])
          rhythmIds.push(transport.schedule(time => graph.rhythm.synth.triggerAttackRelease(hz, gap * RHYTHM_NOTE_SHARE, time), start + i * gap))
        }
        return
      }
      case 'motion': {
        const { synth, out, filter, panner } = graph.motion
        setLevel(out, a.level, at)
        if (!a.sounding) {
          if (motionOn) synth.triggerRelease(at)
          motionOn = false
          return
        }
        if (!motionOn) {
          synth.triggerAttack(midiToHz(MOTION_PAD_MIDI + preset.tonic), at)
          motionOn = true
        }
        filter.frequency.rampTo(motionHz(a.brightness), PARAM_RAMP_S, at)
        aimPanner(panner, wide(a.pan), 0, at)
        return
      }
      case 'time': {
        setLevel(graph.time.out, a.level, at)
        if (!a.sounding) {
          stopPulse()
          return
        }
        // An accent waits for the next click; a frame without one does not cancel it.
        if (a.accent && a.accent !== 'none') accent = a.accent
        const bpm = a.pulseBpm ?? preset.bpm
        if (!pulse || pulse.bpm !== bpm) {
          stopPulse()
          pulse = { bpm, id: transport.scheduleRepeat(click, 60 / bpm, toTransport(at)) }
        }
        return
      }
    }
  }

  function run(frame: MusicFrame, at: number) {
    for (const action of planFrame(frame, detail, { solo, muted, brightness: preset.brightness })) act(action, frame, at)
  }

  /** The seeded dropout cue: two taps, no noise. */
  function playDropout(atTime?: number) {
    if (!ctx.canSound()) return
    const at = atTime ?? defaultTime()
    dropoutTaps(DROPOUT_SEED).forEach((tap, i) => graph.dropout[i].triggerAttackRelease(midiToHz(tap.midi), DROPOUT_TAP_S, at + tap.offsetS, tap.level))
  }

  function apply(frame: MusicFrame, atTime?: number) {
    if (!ctx.canSound()) return
    const at = atTime ?? defaultTime()
    const onset = frame.dropout && !wasDropout
    // A caller faster than 20 frames a second is held back; the start of a dropout is never lost.
    if (!onset && lastAt !== null && at - lastAt < MIN_APPLY_GAP_S) return
    lastAt = at
    lastFrame = frame
    run(frame, at)
    if (onset) playDropout(at)
    wasDropout = frame.dropout
  }

  /** The mix changed (detail, solo, mute): set the voices again for the last frame, now. */
  function remix() {
    if (lastFrame && ctx.canSound()) run(lastFrame, defaultTime())
  }

  function hold(tone: HeldTone | null, atTime?: number) {
    if (!ctx.canSound()) return
    const at = atTime ?? defaultTime()
    const voice = graph.hold
    if (tone === null) {
      if (holdMidi !== null) voice.synth.triggerRelease(at)
      holdMidi = null
      setLevel(voice.out, 0, at)
      return
    }
    aimPanner(voice.panner, wide(tone.pan), tone.elevation ?? 0, at)
    voice.filter.frequency.rampTo(holdHz(tone.brightness), PARAM_RAMP_S, at)
    setLevel(voice.out, clamp01(tone.level), at)
    const hz = midiToHz(tone.midi)
    if (holdMidi === null) voice.synth.triggerAttack(hz, at)
    else if (tone.midi !== holdMidi) voice.synth.setNote(hz, at)
    holdMidi = tone.midi
  }

  function playNotes(notes: NoteEvent[], atTime?: number) {
    if (!ctx.canSound()) return
    const at = atTime ?? defaultTime()
    notes.slice(0, SCAN_VOICES).forEach((note, i) => {
      const voice = graph.scan[i]
      aimPanner(voice.panner, wide(note.pan), note.elevation ?? 0, at)
      voice.filter.frequency.setValueAtTime(holdHz(note.brightness ?? 0.5), at)
      voice.synth.triggerAttackRelease(midiToHz(note.midi), note.seconds, at, clamp01(note.level))
    })
  }

  /** Releases every voice at `at` and forgets what was sounding, so the next frame sets them all again. */
  function releaseAll(at: number = ctx.clock()) {
    graph.melody.synth.triggerRelease(at)
    for (const synth of graph.harmony.synths) synth.triggerRelease(at)
    graph.bass.synth.triggerRelease(at)
    for (const slot of graph.hotspots) slot.synth.triggerRelease(at)
    graph.motion.synth.triggerRelease(at)
    graph.hold.synth.triggerRelease(at)
    clearRhythm()
    melodyMidi = null
    harmonyKey = null
    bassMidi = null
    slots.fill(null)
    motionOn = false
    holdMidi = null
  }

  /** Forgets the last frame and the pulse (the caller has cleared the Transport). */
  function reset() {
    stopPulse()
    accent = 'none'
    lastAt = null
    lastFrame = null
    wasDropout = false
  }

  return {
    apply, hold, playNotes, playDropout, releaseAll, reset,
    setDetail(level: DetailLevel) { detail = level; remix() },
    setSolo(voice: VoiceId | null) { solo = voice; remix() },
    setMuted(voice: VoiceId, isMuted: boolean) {
      if (isMuted) muted.add(voice)
      else muted.delete(voice)
      remix()
    },
  }
}

export type Player = ReturnType<typeof createPlayer>
