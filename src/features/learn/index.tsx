import { useEffect, useMemo, useState } from 'react'
import { hasChange } from '../../analysis/available'
import type { Contour } from '../../analysis'
import { Button, Card, Notice, useAnnounce } from '../../components'
import { createSoundEngine, type SequenceStep, type SoundEngine } from '../../audio'
import { useSoundStyle } from '../../audio/style'
import { variableWords, type CategoryId, type SoundMapping } from '../../data'
import { describeContour } from '../../describe'
import { useDescriptionDetail } from '../../describe/detail'
import { currentDataParam, hashFor } from '../../route'
import type { PageProps } from '../types'
import { LEGEND_GAP_MS, legendSteps } from './legendTour'
import './learn.css'

/** Gap between sounds in "Play all", long enough to hear each one finish. */
const PLAY_ALL_GAP_MS = LEGEND_GAP_MS
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

/** One example line for the trace card: a gentle curve from the west to the east at the first contour level. Made here, so the card needs no analysis. */
function exampleLine(level: number): Contour {
  const points = Array.from({ length: 12 }, (_, i) => {
    const t = i / 11
    return { x: 0.1 + 0.8 * t, y: 0.65 - 0.3 * Math.sin(t * Math.PI), turn: 0, front: 1 }
  })
  return { level, closed: false, brokenEnds: 0, brokenStart: false, brokenEnd: false, points }
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
  const announce = useAnnounce()
  const [style] = useSoundStyle()
  const [detail] = useDescriptionDetail()
  // Learn teaches the notes of "full" and "simple"; the change style is not taught here, so it plays as "full".
  useEffect(() => { engine?.setStyle(style === 'change' ? 'full' : style) }, [engine, style])

  // Silence the sounds when leaving the page or when the data changes.
  useEffect(() => () => engine?.stop(), [engine])

  if (!visualization) return <p>Loading the sounds…</p>
  const { mapping, variable } = visualization
  const words = variableWords(variable)
  const unit = variable.unit
  const changeOn = hasChange(visualization)
  const line = exampleLine(mapping.contourLevels?.[0]?.value ?? 1)

  /** Browsers only allow sound after a click or key press, so the first press unlocks the engine. */
  async function play(label: string, action: (engine: SoundEngine) => void) {
    if (!engine) return
    await engine.unlock()
    setPlayingAll(false)
    engine.stop()
    // The listener's own style first: the change cards borrow the change style, and must not leave it on for the others.
    engine.setStyle(style === 'change' ? 'full' : style)
    action(engine)
    announce(`Playing ${label}.`)
  }

  function playAll() {
    const steps = legendSteps(mapping)
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

  /** The change style's five steps, most below normal first, one after the other. The status line names each as it sounds. */
  function playChange() {
    const steps = (mapping.changeSteps ?? []).map((step, index) => ({
      category: categoryAt(mapping, 0.5), atMs: index * PLAY_ALL_GAP_MS, changeStep: step.id,
    }))
    void play('change from normal', engine => {
      engine.setStyle('change')
      setPlayingAll(true)
      engine.playSequence(steps, index => {
        announce(`Playing ${mapping.changeSteps?.[index]?.label ?? 'a step'}.`)
        if (index === steps.length - 1) window.setTimeout(() => setPlayingAll(false), PLAY_ALL_GAP_MS)
      }, { tick: false })
    })
  }

  /** One example line as a moving sound, as "Trace the edge" plays each line on Listen. */
  function playTrace(line: Contour) {
    void play('an example line', engine => {
      engine.setStyle('change')
      setPlayingAll(true)
      engine.traceContour(line, index => {
        if (index === line.points.length - 1) window.setTimeout(() => setPlayingAll(false), PLAY_ALL_GAP_MS)
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
        {mapping.categories.length} sounds, {words.lowest} to {words.highest}: {mapping.categories.map(category => category.label).join(', ')}.
        {' '}Where the value is {words.lower}, the note is lower; where it is {words.higher}, the note is higher.
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
                  When the place you listen to is all one value you hear one deep note under the melody; when it is mixed, you hear a chord.
                </p>
                <div className="learn__buttons">
                  <Button disabled={!engine} onClick={() => void play('all one value', e => e.playCategory(categoryAt(mapping, 0.75), { pad: [categoryAt(mapping, 0.75)] }))}>
                    Play: all one value
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
                <p>When the value changes from one date to the next, the note slides to its new pitch. A longer slide is a bigger change.</p>
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
            <p>A rough, hissing sound instead of a note. It means there is not enough data for that date, so it is never mistaken for a low value.</p>
            <Button disabled={!engine} onClick={() => void play('missing data', e => e.playMissing())}>Play: missing data</Button>
          </Card>
        </li>
      </ul>

      {changeOn && (
        <ul className="learn__list">
          <li>
            <Card title="Change from normal" headingLevel={2}>
              <p>
                In the sound style Change from normal, each date plays how far it is from normal, not whether it is {words.lower} or {words.higher}. There are {mapping.changeSteps?.length} steps,
                from {mapping.changeSteps?.[0].label.toLowerCase()} to {mapping.changeSteps?.[(mapping.changeSteps?.length ?? 1) - 1].label.toLowerCase()}. Normal sounds steady, and the further from normal, the brighter the sound.
              </p>
              <Button disabled={!engine} onClick={playChange}>Play: change from normal</Button>
            </Card>
          </li>
          <li>
            <Card title={`The ${words.edge}`} headingLevel={2}>
              <p>
                A line on the map marks where the change reaches a set level. On Listen, in the style Change from normal, press T to hear each line traced
                as a sound that moves from one end to the other across the map. Press Escape to stop.
              </p>
              <Button disabled={!engine} onClick={() => playTrace(line)}>Play: an example line</Button>
              <p>In words: {describeContour(visualization, line, { detail })}</p>
            </Card>
          </li>
        </ul>
      )}

      <Card title="Explore the map" headingLevel={2}>
        <p>
          On the Listen page, press Explore the map to move over the whole map by sound. Arrow keys move one place, and Shift with an arrow
          moves four. Home and End go to the west and east edges, and Page Up and Page Down to the north and south. Space plays the place
          again, Enter plays the row from west to east, Shift with Enter plays the column from north to south, and Escape stops.
          L locks the place you are on. Then press Play this place across the dates to hear that one place on every date, and L again to unlock.
          On a phone, use the two sliders and the sweep buttons instead.
        </p>
        <a className="learn__next" href={hashFor('listen', { data: currentDataParam() })}>Try Explore the map on Listen</a>
      </Card>

      <div className="learn__actions">
        <Button variant="primary" disabled={!engine} onClick={playAll}>Play all, {words.lowest} to {words.highest}</Button>
        <Button disabled={!engine || !playingAll} onClick={stop}>Stop</Button>
      </div>

      <p>
        Ready? <a className="learn__next" href={hashFor('listen', { data: currentDataParam() })}>Go to Listen</a>
      </p>
    </div>
  )
}

