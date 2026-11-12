// Plays the Jukebox orchestrator's AudioPayload (G09) with Tone.js: one Play/Stop button.
//
// Each track is one Tone.Synth driven by one Tone.Sequence over its volume_curve. A step sets the synth's volume and plays a note
// (payload.ts says which). Every synth goes through one limiter. Tone loads on the first Play, and no sound is made before it.
//
// Not on a page of the app yet. It uses Tone's one Transport, which the app's own player also uses, so the two must not play at the
// same time (see the ticket).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Notice, useAnnounce } from '../../components'
import { stepSeconds, totalSeconds, trackSteps, type AudioPayload, type Step } from './payload'
import './jukebox.css'

type ToneModule = typeof import('tone')

/** The peak never goes above this (the guardrail for everything that makes sound). */
const LIMIT_DB = -1
/** A note sounds for this share of its step, so two notes in a row are heard as two. */
const NOTE_LENGTH = 0.9

/** Builds the synths and sequences, starts the Transport, and returns the function that silences and removes all of it. */
function startPlayback(tone: ToneModule, payload: AudioPayload, onEnd: () => void): () => void {
  const transport = tone.getTransport()
  const step = stepSeconds(payload)
  const limiter = new tone.Limiter(LIMIT_DB).toDestination()

  transport.stop()
  transport.position = 0
  transport.bpm.value = payload.base_bpm

  const voices = payload.tracks.map(track => {
    const synth = new tone.Synth().connect(limiter)
    const sequence = new tone.Sequence<Step | null>(
      (time, value) => {
        if (!value) return
        // Shared between the tracks, so several at full volume do not just sit on the limiter.
        synth.volume.setValueAtTime(tone.gainToDb(value.gain / payload.tracks.length), time)
        synth.triggerAttackRelease(value.frequency, step * NOTE_LENGTH, time)
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
  // Draw waits for the page to be painted, which never happens in a background tab.)
  let timer: ReturnType<typeof setTimeout> | undefined
  const end = transport.scheduleOnce(time => {
    timer = setTimeout(onEnd, Math.max(0, time - tone.now()) * 1000)
  }, totalSeconds(payload) + step)
  transport.start()

  return () => {
    transport.clear(end)
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
}

export function JukeboxPlayer({ payload }: Props) {
  const announce = useAnnounce()
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  /** Silences what is playing. Null when nothing is. */
  const stopPlayback = useRef<(() => void) | null>(null)
  /** Goes up on every Play and Stop, so a Play that was still loading Tone knows it has been overtaken. */
  const attempt = useRef(0)

  const stop = useCallback(() => {
    attempt.current += 1
    stopPlayback.current?.()
    stopPlayback.current = null
    setPlaying(false)
  }, [])

  // A new payload, or leaving the page, ends the old sound.
  useEffect(() => stop, [payload, stop])

  async function play() {
    const mine = (attempt.current += 1)
    setFailed(false)
    setPlaying(true)
    try {
      const tone = await import('tone')
      await tone.start()
      if (attempt.current !== mine) return
      stopPlayback.current = startPlayback(tone, payload, () => {
        if (attempt.current !== mine) return
        stop()
        announce('Finished')
      })
      announce('Playing')
    } catch {
      if (attempt.current !== mine) return
      stop()
      setFailed(true)
    }
  }

  const trackCount = payload.tracks.length
  const seconds = Math.round(totalSeconds(payload))

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
      {failed && <Notice variant="error">The sound could not start. Try again.</Notice>}
    </section>
  )
}
