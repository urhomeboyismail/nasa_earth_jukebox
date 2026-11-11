// Seven voices (docs/PLAN.md §6.3, ticket SN11): one card for each voice of the ensemble, with a button that plays the data set on screen with only that
// voice audible. Nothing sounds before a click. The ensemble starts from the button, the checked frames step at the slow speed, and each frame's music goes to it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FrameSequenceSource } from '../../analysis/video/frameSequence'
import { Button, Notice, useAnnounce } from '../../components'
import { useEnsemble } from '../../audio/ensemble/useEnsemble'
import { VOICE_IDS, type VoiceId, type Visualization } from '../../data'
import { presetFor, toMusicFrame, type MusicFrame } from '../../sonify'
import { VOICE_CARDS } from './voiceCards'

type CardProps = {
  id: VoiceId
  name: string
  means: string
  listen: string
  /** False when the data set does not use this voice. */
  allowed: boolean
  /** The voice playing now, if any. */
  playing: VoiceId | null
  onPlay: (id: VoiceId) => void
  onStop: () => void
}

function VoiceCard({ id, name, means, listen, allowed, playing, onPlay, onStop }: CardProps) {
  const headingId = `voice-card-${id}`
  const mine = playing === id
  return (
    <section className="ui-card ui-card--elevated" aria-labelledby={headingId}>
      <h3 id={headingId} className="ui-card__title">{name}</h3>
      <div className="ui-card__body">
        <p>{means}</p>
        <p>{listen}</p>
        {allowed ? (
          <div className="learn__buttons">
            <Button disabled={playing !== null} onClick={() => onPlay(id)}>Play {name.toLowerCase()} alone</Button>
            <Button disabled={!mine} onClick={onStop}>Stop {name.toLowerCase()}</Button>
          </div>
        ) : (
          <p>This data set does not use this voice.</p>
        )}
        {mine && <p>Playing {name.toLowerCase()} alone.</p>}
      </div>
    </section>
  )
}

export function VoiceCards({ visualization }: { visualization: Visualization }) {
  const presetId = visualization.sonification?.preset ?? 'major'
  const preset = useMemo(() => presetFor(presetId), [presetId])
  // Learn plays one voice at a time, so every voice is allowed to sound whatever the listener's detail level is elsewhere.
  const { ensemble, start } = useEnsemble(preset, 'full')
  const announce = useAnnounce()
  const [playing, setPlaying] = useState<VoiceId | null>(null)
  const [error, setError] = useState('')
  const source = useRef<FrameSequenceSource | null>(null)
  // Bumped on every play and stop, so a click that was waiting for the audio to start does not carry on after a stop.
  const run = useRef(0)
  const allowed = visualization.sonification?.voices ?? VOICE_IDS

  const finish = useCallback(() => {
    run.current++
    source.current?.dispose()
    source.current = null
    ensemble.solo(null)
    ensemble.stop()
    setPlaying(null)
  }, [ensemble])

  // Silence the card when leaving the page, or when the data set or preset changes.
  useEffect(() => finish, [finish, visualization])

  const play = useCallback(async (id: VoiceId) => {
    finish()
    const mine = run.current
    setError('')
    await start()
    if (mine !== run.current) return
    ensemble.solo(id)
    setPlaying(id)
    announce(`Playing ${VOICE_CARDS.find(card => card.id === id)?.name.toLowerCase() ?? id} alone.`)
    let previous: MusicFrame | null = null
    const next = new FrameSequenceSource({
      visualization,
      step: 'slow',
      onFrame: live => {
        previous = toMusicFrame(live.features, preset, previous)
        ensemble.apply(previous)
      },
      onStatus: (status, reason) => {
        if (mine !== run.current) return
        if (status === 'error') {
          setError(reason ?? 'The frames could not be read.')
          finish()
        } else if (status === 'stopped') finish()
      },
    })
    source.current = next
    next.start()
  }, [announce, ensemble, finish, preset, start, visualization])

  return (
    <section className="learn__voices" aria-labelledby="voice-cards-heading">
      <h2 id="voice-cards-heading">Seven voices</h2>
      <p>The picture is read frame by frame. Each voice tells you one thing. Play one alone first.</p>
      <p>Played on: {visualization.title}.</p>
      {error && <Notice variant="error">The voice could not be played. {error}</Notice>}
      <ul className="learn__list">
        {VOICE_CARDS.map(card => (
          <li key={card.id}>
            <VoiceCard {...card} allowed={allowed.includes(card.id)} playing={playing} onPlay={id => void play(id)} onStop={finish} />
          </li>
        ))}
      </ul>
    </section>
  )
}
