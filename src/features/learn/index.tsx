import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Notice } from '../../components'
import { createSoundEngine, type SoundEngine } from '../../audio'
import type { SoundMapping } from '../../data'
import type { PageProps } from '../types'
import './learn.css'

/** Gap between sounds in "Play all", long enough to hear each one finish. */
const PLAY_ALL_GAP_MS = 1200

function describeRange(range: [number, number], unit: string) {
  return `${range[0]} to ${range[1]} ${unit}`.trim()
}

function useEngine(mapping: SoundMapping | undefined): { engine: SoundEngine | null; error: string } {
  return useMemo(() => {
    if (!mapping) return { engine: null, error: '' }
    try {
      return { engine: createSoundEngine(mapping), error: '' }
    } catch (error) {
      return { engine: null, error: error instanceof Error ? error.message : String(error) }
    }
  }, [mapping])
}

export default function LearnPage({ visualization }: PageProps) {
  const { engine, error } = useEngine(visualization?.mapping)
  const [playingAll, setPlayingAll] = useState(false)
  const [lastPlayed, setLastPlayed] = useState('')

  // Silence the sounds when leaving the page or when the data changes.
  useEffect(() => () => engine?.stop(), [engine])

  if (!visualization) return <p>Loading the sounds…</p>
  const { mapping, variable } = visualization
  const unit = variable.unit

  /** Browsers only allow sound after a click or key press, so the first press unlocks the engine. */
  async function play(label: string, action: (engine: SoundEngine) => void) {
    if (!engine) return
    await engine.unlock()
    setPlayingAll(false)
    engine.stop()
    action(engine)
    setLastPlayed(label)
  }

  function playAll() {
    const steps = mapping.categories.map((category, index) => ({ category: category.id, atMs: index * PLAY_ALL_GAP_MS }))
    void play('all sounds', engine => {
      setPlayingAll(true)
      engine.playSequence(steps, index => {
        if (index === steps.length - 1) window.setTimeout(() => setPlayingAll(false), PLAY_ALL_GAP_MS)
      })
    })
  }

  function stop() {
    engine?.stop()
    setPlayingAll(false)
  }

  return (
    <div className="learn">
      <p>Learn what each sound means before you listen to the data.</p>
      <p>
        {mapping.categories.length} sounds, coolest to warmest: {mapping.categories.map(category => category.label).join(', ')}.
        {' '}A cooler place is a lower note, and a warmer place is a higher note.
      </p>

      {error && <Notice variant="error">The sounds could not be set up. {error}</Notice>}

      <ul className="learn__list">
        {mapping.categories.map(category => (
          <li key={category.id}>
            <Card title={category.label} headingLevel={2}>
              <p>{describeRange(category.range, unit)}. Plays the note {category.note}.</p>
              <Button disabled={!engine} onClick={() => void play(category.label, e => e.playCategory(category.id))}>
                Play: {category.label}
              </Button>
            </Card>
          </li>
        ))}
        <li>
          <Card title="The tick" headingLevel={2}>
            <p>A short, quiet tick. It marks the move from one date to the next.</p>
            <Button disabled={!engine} onClick={() => void play('the tick', e => e.playTick())}>Play: the tick</Button>
          </Card>
        </li>
        <li>
          <Card title="Missing data" headingLevel={2}>
            <p>A rough, hissing sound instead of a note. It means there is no data for that date, so it is never mistaken for cold.</p>
            <Button disabled={!engine} onClick={() => void play('missing data', e => e.playMissing())}>Play: missing data</Button>
          </Card>
        </li>
      </ul>

      <div className="learn__actions">
        <Button variant="primary" disabled={!engine} onClick={playAll}>Play all, coolest to warmest</Button>
        <Button disabled={!engine || !playingAll} onClick={stop}>Stop</Button>
      </div>

      <p role="status" className="sr-only">{lastPlayed && `Playing ${lastPlayed}.`}</p>

      <p>
        Ready? <a className="learn__next" href="#listen">Go to Listen</a>
      </p>
    </div>
  )
}

