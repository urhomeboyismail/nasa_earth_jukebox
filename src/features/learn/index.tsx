import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Notice } from '../../components'
import { createSoundEngine, type SequenceStep, type SoundEngine } from '../../audio'
import { useSoundStyle } from '../../audio/style'
import type { CategoryId, SoundMapping } from '../../data'
import { currentDataParam, hashFor } from '../../route'
import type { PageProps } from '../types'
import './learn.css'

/** Gap between sounds in "Play all", long enough to hear each one finish. */
const PLAY_ALL_GAP_MS = 1200
/** Gap between the two notes of the slide and the bell, long enough to hear the first before the change. */
const PAIR_GAP_MS = 900

/**
 * A category a fraction of the way up the scale: 0 is the coolest, 1 the warmest. The cards say "cool", "mild", "warm" and "hot"
 * for any data set, so they are found by position rather than by name.
 */
function categoryAt(mapping: SoundMapping, fraction: number): CategoryId {
  const { categories } = mapping
  return categories[Math.round(fraction * (categories.length - 1))].id
}

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
  const [style] = useSoundStyle()
  useEffect(() => { engine?.setStyle(style) }, [engine, style])

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

  /** The same two notes, cool then hot, with the slide or the bell on the second. */
  function playPair(label: string, extra: Pick<SequenceStep, 'glide' | 'bell'>) {
    const steps: SequenceStep[] = [
      { category: categoryAt(mapping, 0.25), atMs: 0 },
      { category: categoryAt(mapping, 1), atMs: PAIR_GAP_MS, ...extra },
    ]
    void play(label, engine => engine.playSequence(steps, () => {}, { tick: false }))
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
        {style === 'full' ? (
          <>
            <li>
              <Card title="The soft chord underneath" headingLevel={2}>
                <p>
                  When the place you listen to is all one temperature you hear one deep note under the melody; when it is mixed, you hear a chord.
                </p>
                <div className="learn__buttons">
                  <Button disabled={!engine} onClick={() => void play('all warm', e => e.playCategory(categoryAt(mapping, 0.75), { pad: [categoryAt(mapping, 0.75)] }))}>
                    Play: all warm
                  </Button>
                  <Button
                    disabled={!engine}
                    onClick={() => void play('mixed', e => e.playCategory(categoryAt(mapping, 0.5), {
                      pad: [...new Set([0.25, 0.5, 0.75].map(fraction => categoryAt(mapping, fraction)))],
                    }))}
                  >
                    Play: mixed
                  </Button>
                </div>
              </Card>
            </li>
            <li>
              <Card title="The slide" headingLevel={2}>
                <p>When the temperature changes from one date to the next, the note slides to its new pitch. A longer slide is a bigger change.</p>
                <Button disabled={!engine} onClick={() => playPair('the slide', { glide: true })}>Play: the slide</Button>
              </Card>
            </li>
            <li>
              <Card title="The bell" headingLevel={2}>
                <p>A bell above the melody means a big jump: two or more steps at once.</p>
                <Button disabled={!engine} onClick={() => playPair('the bell', { bell: true })}>Play: the bell</Button>
              </Card>
            </li>
          </>
        ) : (
          <li>
            <Card title="Simple sound" headingLevel={2}>
              <p>Simple sound is on: you hear only the main note.</p>
            </Card>
          </li>
        )}
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

      <Card title="Explore the map" headingLevel={2}>
        <p>
          On the Listen page, press Explore the map to move over the whole map by sound. Arrow keys move one place, and Shift with an arrow
          moves four. Home and End go to the west and east edges, and Page Up and Page Down to the north and south. Space plays the place
          again, Enter plays the row from west to east, Shift with Enter plays the column from north to south, and Escape stops.
          On a phone, use the two sliders and the sweep buttons instead.
        </p>
        <a className="learn__next" href={hashFor('listen', { data: currentDataParam() })}>Try Explore the map on Listen</a>
      </Card>

      <div className="learn__actions">
        <Button variant="primary" disabled={!engine} onClick={playAll}>Play all, coolest to warmest</Button>
        <Button disabled={!engine || !playingAll} onClick={stop}>Stop</Button>
      </div>

      <p role="status" className="sr-only">{lastPlayed && `Playing ${lastPlayed}.`}</p>

      <p>
        Ready? <a className="learn__next" href={hashFor('listen', { data: currentDataParam() })}>Go to Listen</a>
      </p>
    </div>
  )
}

