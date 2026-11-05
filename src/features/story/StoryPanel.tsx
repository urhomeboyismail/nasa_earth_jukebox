// Story mode (ticket T83): a short, written walk through the data, one chapter at a time. Each chapter can be played on its own.
// It never moves on by itself, so it never talks over a screen reader.

import { useEffect, useRef, useState } from 'react'
import type { FrameAnalysis } from '../../analysis'
import { Button } from '../../components'
import type { StoryChapter, Visualization } from '../../data'
import { describeSequence } from '../../describe'
import './story.css'

type Props = {
  visualization: Visualization
  chapters: StoryChapter[]
  results: FrameAnalysis[] | null
  /** Plays only these dates (indexes into the frames), then stops. */
  playRange: (from: number, to: number) => void
  /** Closes the panel; the caller stops the sound and puts focus back on "Hear the story". */
  onClose: () => void
}

export function StoryPanel({ visualization, chapters, results, playRange, onClose }: Props) {
  const [chapter, setChapter] = useState(0)
  const [ended, setEnded] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const { frames } = visualization
  const current = chapters[chapter]
  const last = chapter === chapters.length - 1

  // Focus goes to the heading when the panel opens and whenever the chapter (or the ending) changes, so a screen reader starts there.
  useEffect(() => { heading.current?.focus() }, [chapter, ended])

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
        <Button disabled={chapter === 0 && !ended} onClick={previous}>Previous chapter</Button>
        {!ended && <Button onClick={next}>{last ? 'Finish' : 'Next chapter'}</Button>}
        <Button onClick={onClose}>Close story</Button>
      </div>
    </section>
  )
}
