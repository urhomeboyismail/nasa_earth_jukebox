// Plays the Jukebox orchestrator's AudioPayload (G09) with Tone.js: one Play/Stop button.
//
// Each track is one synth driven by one Tone.Sequence over its volume_curve. The voice depends on the instrument's name (timbreOf).
// A step sets the synth's volume and plays a note (payload.ts says which). Every synth goes through one limiter. Tone loads on the
// first Play, and no sound is made before it.
//
// With a `vision` prop (G10), each description is put on the Transport at its time (captionTimes). At that moment it is shown,
// announced, and spoken if the listener turned speech on. The caption region is not a live region: the announcer already reads the text.
//
// Not on a page of the app yet. It uses Tone's one Transport, which the app's own player also uses, so the two must not play at the
// same time (see the ticket).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Notice, useAnnounce } from '../../components'
import { hush, speak } from '../welcome/speak'
import { captionTimes, stepSeconds, timbreOf, totalSeconds, trackSteps, type AudioPayload, type Caption, type Step, type VisionPayload } from './payload'
import './jukebox.css'

type ToneModule = typeof import('tone')

/** The peak never goes above this (the guardrail for everything that makes sound). */
const LIMIT_DB = -1
/** A note sounds for this share of its step, so two notes in a row are heard as two. */
const NOTE_LENGTH = 0.9

/** The voice for a track. `octave` multiplies each note's frequency: a bass plays an octave lower. */
function buildVoice(tone: ToneModule, instrument: string) {
  switch (timbreOf(instrument)) {
    case 'bass':
      return { synth: new tone.Synth({ oscillator: { type: 'triangle' } }), octave: 0.5 }
    case 'pad':
      return { synth: new tone.AMSynth({ envelope: { attack: 0.1 } }), octave: 1 }
    default:
      return { synth: new tone.Synth({ oscillator: { type: 'sawtooth' } }), octave: 1 }
  }
}

/** Builds the synths and sequences, starts the Transport, and returns the function that silences and removes all of it. */
function startPlayback(
  tone: ToneModule,
  payload: AudioPayload,
  captions: Caption[],
  onEnd: () => void,
  onCaption: (caption: Caption) => void,
): () => void {
  const transport = tone.getTransport()
  const step = stepSeconds(payload)
  const limiter = new tone.Limiter(LIMIT_DB).toDestination()

  transport.stop()
  transport.position = 0
  transport.bpm.value = payload.base_bpm

  const voices = payload.tracks.map(track => {
    const { synth, octave } = buildVoice(tone, track.instrument)
    synth.connect(limiter)
    const sequence = new tone.Sequence<Step | null>(
      (time, value) => {
        if (!value) return
        // Shared between the tracks, so several at full volume do not just sit on the limiter.
        synth.volume.setValueAtTime(tone.gainToDb(value.gain / payload.tracks.length), time)
        synth.triggerAttackRelease(value.frequency * octave, step * NOTE_LENGTH, time)
      },
      trackSteps(track),
      '8n',
    )
    sequence.loop = false
    sequence.start(0)
    return { synth, sequence }
  })

  // One step after the last note, so its tail is not cut off. The Transport calls back a little early, on the audio clock, and
  // nothing may stop it from inside that call, so a timer runs `onEnd` at the time the call was for. (A timer, not Tone's Draw:
  // Draw waits for the page to be painted, which never happens in a background tab.) The descriptions work the same way.
  let timer: ReturnType<typeof setTimeout> | undefined
  const end = transport.scheduleOnce(time => {
    timer = setTimeout(onEnd, Math.max(0, time - tone.now()) * 1000)
  }, totalSeconds(payload) + step)
  const captionTimers = new Set<ReturnType<typeof setTimeout>>()
  const captionEvents = captions.map(caption =>
    transport.scheduleOnce(time => {
      const handle = setTimeout(() => {
        captionTimers.delete(handle)
        onCaption(caption)
      }, Math.max(0, time - tone.now()) * 1000)
      captionTimers.add(handle)
    }, caption.at),
  )
  transport.start()

  return () => {
    transport.clear(end)
    for (const id of captionEvents) transport.clear(id)
    for (const handle of captionTimers) clearTimeout(handle)
    clearTimeout(timer)
    transport.stop()
    for (const { synth, sequence } of voices) {
      sequence.dispose()
      synth.dispose()
    }
    limiter.dispose()
  }
}

type Props = {
  /** The `audio` field of the route's answer, already checked with `parseAudioPayload`. */
  payload: AudioPayload
  /** The `vision` field, already checked with `parseVisionPayload`. Without it the player shows no captions. */
  vision?: VisionPayload | null
}

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

export function JukeboxPlayer({ payload, vision }: Props) {
  const announce = useAnnounce()
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const [caption, setCaption] = useState<Caption | null>(null)
  const [spoken, setSpoken] = useState(false)
  /** Read when a description comes up, so the toggle applies to the next one without rebuilding the sound. */
  const spokenRef = useRef(false)
  /** Silences what is playing. Null when nothing is. */
  const stopPlayback = useRef<(() => void) | null>(null)
  /** Goes up on every Play and Stop, so a Play that was still loading Tone knows it has been overtaken. */
  const attempt = useRef(0)

  const stop = useCallback(() => {
    attempt.current += 1
    stopPlayback.current?.()
    stopPlayback.current = null
    hush()
    setCaption(null)
    setPlaying(false)
  }, [])

  // A new payload, or leaving the page, ends the old sound.
  useEffect(() => stop, [payload, vision, stop])

  async function play() {
    const mine = (attempt.current += 1)
    setFailed(false)
    setPlaying(true)
    try {
      const tone = await import('tone')
      await tone.start()
      if (attempt.current !== mine) return
      stopPlayback.current = startPlayback(
        tone,
        payload,
        vision ? captionTimes(vision, payload) : [],
        () => {
          if (attempt.current !== mine) return
          stop()
          announce('Finished')
        },
        next => {
          if (attempt.current !== mine) return
          setCaption(next)
          announce(next.alt_text)
          if (spokenRef.current) void speak(next.alt_text)
        },
      )
      announce('Playing')
    } catch {
      if (attempt.current !== mine) return
      stop()
      setFailed(true)
    }
  }

  const trackCount = payload.tracks.length
  const seconds = Math.round(totalSeconds(payload))
  const hasCaptions = !!vision && vision.descriptions.length > 0

  return (
    <section className="jukebox-player" aria-label="Jukebox player">
      <Button
        variant="primary"
        size="medium"
        onClick={() => {
          if (playing) {
            stop()
            announce('Stopped')
          } else void play()
        }}
      >
        {playing ? 'Stop' : 'Play'}
      </Button>
      <p className="jukebox-player__summary">
        {trackCount === 1 ? '1 track' : `${trackCount} tracks`} at {payload.base_bpm} beats a minute, about {seconds}{' '}
        {seconds === 1 ? 'second' : 'seconds'}.
      </p>
      <ul className="jukebox-player__tracks">
        {payload.tracks.map((track, index) => (
          <li key={index}>
            {track.instrument}: MIDI notes {track.pitch_range[0]} to {track.pitch_range[1]}, {track.volume_curve.length} steps
          </li>
        ))}
      </ul>
      {hasCaptions && (
        <>
          {canSpeak() && (
            <label className="jukebox-player__speech">
              <input
                type="checkbox"
                checked={spoken}
                onChange={event => {
                  spokenRef.current = event.target.checked
                  setSpoken(event.target.checked)
                  if (!event.target.checked) hush()
                }}
              />
              Spoken narration (Web Speech API)
            </label>
          )}
          <div className="jukebox-player__caption">
            {caption ? (
              <>
                <span className="jukebox-player__intensity">{caption.intensity_level} intensity</span>
                <p>{caption.alt_text}</p>
              </>
            ) : (
              <p>Descriptions appear here while it plays.</p>
            )}
          </div>
        </>
      )}
      {failed && <Notice variant="error">The sound could not start. Try again.</Notice>}
    </section>
  )
}
