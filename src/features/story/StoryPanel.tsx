// Story mode (ticket T83): a short, written walk through the data, one chapter at a time. Each chapter can be played on its own.
// It never moves on by itself, so it never talks over a screen reader.

import { useEffect, useRef, useState } from 'react'
import type { FrameAnalysis } from '../../analysis'
import { Button } from '../../components'
import type { StoryChapter, Visualization } from '../../data'
import { describeSequence } from '../../describe'
import type { Predict } from '../predict/usePredict'
import './story.css'

type Props = {
  visualization: Visualization
  chapters: StoryChapter[]
  results: FrameAnalysis[] | null
  /** Plays only these dates (indexes into the frames), then stops. */
  playRange: (from: number, to: number) => void
  /** IX05: a chapter whose first date has a question gets a Predict button. Left out where there is no question to ask. */
  predict?: Pick<Predict, 'questionAt' | 'prepare' | 'ask'>
  /** Closes the panel; the caller stops the sound and puts focus back on "Hear the story". */
  onClose: () => void
}

export function StoryPanel({ visualization, chapters, results, playRange, predict, onClose }: Props) {
  const [chapter, setChapter] = useState(0)
  const [ended, setEnded] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const { frames } = visualization
  const current = chapters[chapter]
  const last = chapter === chapters.length - 1

  // Focus goes to the heading when the panel opens and whenever the chapter (or the ending) changes, so a screen reader starts there.
  useEffect(() => { heading.current?.focus() }, [chapter, ended])

  // The question is about the date the chapter starts on.
  const firstIndex = frames.findIndex(frame => frame.id === current?.fromFrame)
  const prepare = predict?.prepare
  useEffect(() => { if (prepare && firstIndex >= 0) prepare(firstIndex) }, [prepare, firstIndex])
  const canPredict = !ended && firstIndex >= 0 && predict?.questionAt(firstIndex) != null

  function playThisPart() {
    const from = frames.findIndex(frame => frame.id === current.fromFrame)
    const to = frames.findIndex(frame => frame.id === current.toFrame)
    if (from >= 0 && to >= 0) playRange(from, to)
  }

  function next() {
    if (last) setEnded(true)
    else setChapter(chapter + 1)
  }

  function previous() {
    if (ended) setEnded(false)
    else setChapter(chapter - 1)
  }

  return (
    <section className="story" aria-label="Story">
      {ended ? (
        <>
          <h2 ref={heading} tabIndex={-1} className="story__title">The end of the story.</h2>
          <p className="story__text">{results ? describeSequence(visualization, results) : ''}</p>
        </>
      ) : (
        <>
          <h2 ref={heading} tabIndex={-1} className="story__title">Chapter {chapter + 1} of {chapters.length}: {current.title}</h2>
          <p className="story__text">{current.text}</p>
        </>
      )}
      <div className="story__buttons">
        {!ended && <Button variant="primary" disabled={!results} onClick={playThisPart}>Play this part</Button>}
        {canPredict && <Button onClick={() => predict?.ask(firstIndex)}>Predict</Button>}
        <Button disabled={chapter === 0 && !ended} onClick={previous}>Previous chapter</Button>
        {!ended && <Button onClick={next}>{last ? 'Finish' : 'Next chapter'}</Button>}
        <Button onClick={onClose}>Close story</Button>
      </div>
    </section>
  )
}
