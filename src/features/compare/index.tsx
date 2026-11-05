import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeAll, type FrameAnalysis } from '../../analysis'
import { createSoundEngine, type SoundEngine } from '../../audio'
import { useSoundStyle } from '../../audio/style'
import { voicingFor } from '../../audio/voicing'
import { useAssistantContext } from '../../assistant/context'
import { AnnouncerProvider, Button, Card, Notice } from '../../components'
import { useAnnounce } from '../../components/useAnnounce'
import type { Visualization } from '../../data'
import { describeFrame } from '../../describe'
import { useDescriptionDetail } from '../../describe/detail'
import { dateFormatterFor } from '../../dates'
import type { PageProps } from '../types'
import './compare.css'
import './test-mode.css'
import { answerText, categoryLabel, judge, type Answer } from './judge'
import TestMode from './TestMode'

const CUSTOM = 'custom'

/** Listening-test mode is open only when the address is #compare?test=1. */
function useTestMode(): boolean {
  const read = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('test') === '1'
  const [on, setOn] = useState(read)
  useEffect(() => {
    const update = () => setOn(read())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return on
}

export default function ComparePage({ visualization }: PageProps) {
  const testMode = useTestMode()
  if (!visualization) return <p>Loading the data…</p>
  if (testMode) return <TestMode key={visualization.id} visualization={visualization} />
  return (
    <AnnouncerProvider>
      <Compare key={visualization.id} visualization={visualization} />
    </AnnouncerProvider>
  )
}

function Compare({ visualization }: { visualization: Visualization }) {
  const { frames, comparisons, regions, colorScale, mapping } = visualization
  const announce = useAnnounce()
  const formatDate = useMemo(() => dateFormatterFor(frames.map(frame => frame.date)), [frames])

  const [choice, setChoice] = useState(comparisons[0]?.id ?? CUSTOM)
  const [customA, setCustomA] = useState(frames[0].id)
  const [customB, setCustomB] = useState(frames[frames.length - 1].id)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<FrameAnalysis[] | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [playError, setPlayError] = useState('')

  const { engine, engineError } = useMemo((): { engine: SoundEngine | null; engineError: string } => {
    try {
      return { engine: createSoundEngine(mapping), engineError: '' }
    } catch (error) {
      return { engine: null, engineError: error instanceof Error ? error.message : String(error) }
    }
  }, [mapping])

  useEffect(() => {
    let cancelled = false
    analyzeAll(frames, regions[0], colorScale, mapping)
      .then(done => { if (!cancelled) setResults(done) })
      .catch((error: unknown) => { if (!cancelled) setAnalysisError(error instanceof Error ? error.message : String(error)) })
    return () => { cancelled = true }
  }, [frames, regions, colorScale, mapping])

  const [soundStyle] = useSoundStyle()
  const [detail] = useDescriptionDetail()
  useEffect(() => { engine?.setStyle(soundStyle) }, [engine, soundStyle])

  // Silence the sounds when leaving the page.
  useEffect(() => () => engine?.stop(), [engine])

  // The button that was pressed disappears on reveal and on "try again", so focus has to be put somewhere sensible.
  // Changing a dropdown after a reveal must not move focus, so only those two actions do it.
  const resultRef = useRef<HTMLDivElement>(null)
  const playRef = useRef<HTMLDivElement>(null)

  const preset = comparisons.find(c => c.id === choice)
  const frameAId = preset ? preset.frameA : customA
  const frameBId = preset ? preset.frameB : customB
  const frameA = frames.find(f => f.id === frameAId)!
  const frameB = frames.find(f => f.id === frameBId)!
  const resultA = results?.find(r => r.frameId === frameAId)
  const resultB = results?.find(r => r.frameId === frameBId)

  // For a ready-made comparison the data says what the right answer is; for the listener's own dates, the analysis does.
  const correct: Answer | null = preset ? preset.answer : judge(resultA, resultB, mapping)
  const canAnswer = correct !== null
  const ready = !!engine && !!results

  useAssistantContext(
    'compare',
    { frameA: frameAId, frameB: frameBId, answered: answer !== null, revealed },
    revealed ? `comparison_revealed:${preset?.id ?? `${frameAId}_${frameBId}`}` : undefined,
  )

  function choose(next: string) {
    engine?.stop()
    setChoice(next)
    setAnswer(null)
    setRevealed(false)
  }

  function pickDate(which: 'a' | 'b', id: string) {
    engine?.stop()
    if (which === 'a') setCustomA(id)
    else setCustomB(id)
    setAnswer(null)
    setRevealed(false)
  }

  /** Plays one date's sound, on the same scale as the other. The first press unlocks the audio. */
  async function playDate(which: 'A' | 'B') {
    const result = which === 'A' ? resultA : resultB
    if (!engine || !result) return
    try {
      await engine.unlock()
      engine.stop()
      if (result.category === 'insufficient') engine.playMissing()
      else {
        // The chord, without the slide or bell: the two dates are not neighbours in a run.
        const pad = voicingFor(results!, results!.indexOf(result), mapping).pad
        if (pad) engine.playCategory(result.category, { pad })
        else engine.playCategory(result.category)
      }
      setPlayError('')
      announce(`Played date ${which}.`)
    } catch (error) {
      setPlayError(error instanceof Error ? error.message : String(error))
    }
  }

  const right = answer !== null && answer === correct
  const explanation = preset?.explanation ??
    (correct ? `${formatDate(frameA.date)} sounded ${categoryLabel(resultA, mapping)} and ${formatDate(frameB.date)} sounded ${categoryLabel(resultB, mapping)}.` : '')

  function reveal() {
    engine?.stop()
    setRevealed(true)
    announce(`${right ? 'Correct.' : 'Not quite.'} ${correct ? `${answerText(correct)}.` : ''} ${explanation}`)
  }

  function tryAgain() {
    setAnswer(null)
    setRevealed(false)
    playRef.current?.querySelector('button')?.focus()
  }

  useEffect(() => {
    if (revealed) resultRef.current?.focus()
  }, [revealed])

  return (
    <div className="compare">
      <p>Choose two dates, listen to each, and decide which shows the change.</p>

      {(engineError || analysisError) && <Notice variant="error">The sounds could not be prepared. {engineError || analysisError}</Notice>}
      {!results && !analysisError && !engineError && <Notice>Analyzing the images…</Notice>}
      {playError && <Notice variant="error">The sound could not be played. {playError}</Notice>}

      <div className="compare__choose">
        <label htmlFor="compare-choice" className="compare__label">Comparison</label>
        <select id="compare-choice" value={choice} onChange={event => choose(event.target.value)}>
          {comparisons.map((c, i) => <option key={c.id} value={c.id}>{`Comparison ${i + 1}`}</option>)}
          <option value={CUSTOM}>Choose my own two dates</option>
        </select>
      </div>

      {!preset && (
        <div className="compare__dates">
          {([['a', 'Date A', frameAId], ['b', 'Date B', frameBId]] as const).map(([which, label, value]) => (
            <div key={which} className="compare__choose">
              <label htmlFor={`compare-date-${which}`} className="compare__label">{label}</label>
              <select id={`compare-date-${which}`} value={value} onChange={event => pickDate(which, event.target.value)}>
                {frames.map(f => <option key={f.id} value={f.id}>{formatDate(f.date)}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <p className="compare__question">{preset?.question ?? 'Which date shows warmer water?'}</p>

      <div className="compare__play" ref={playRef}>
        <Button variant="primary" disabled={!ready} onClick={() => void playDate('A')}>Play date A</Button>
        <Button variant="primary" disabled={!ready} onClick={() => void playDate('B')}>Play date B</Button>
      </div>

      {!canAnswer && ready && !preset && (
        <Notice>One of these dates has no usable data, so there is no right answer. Choose two other dates.</Notice>
      )}

      <fieldset className="compare__answer" disabled={revealed || !canAnswer}>
        <legend>Your answer</legend>
        {([['a', 'A is warmer'], ['b', 'B is warmer'], ['same', 'About the same']] as const).map(([value, label]) => (
          <label key={value} className="compare__option">
            <input type="radio" name="answer" value={value} checked={answer === value} onChange={() => setAnswer(value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {!revealed ? (
        <Button disabled={answer === null || !canAnswer} onClick={reveal}>Reveal the answer</Button>
      ) : (
        <div className="compare__result" ref={resultRef} tabIndex={-1} role="region" aria-label="Result">
          <Notice>
            <strong>{right ? 'Correct. ' : 'Not quite. '}</strong>
            {correct && `${answerText(correct)}.`} {explanation}
          </Notice>
          <ul className="compare__images">
            {([['Date A', frameA], ['Date B', frameB]] as const).map(([label, frame]) => (
              <li key={label}>
                <Card title={`${label}: ${formatDate(frame.date)}`} headingLevel={2}>
                  <img src={frame.image} alt={frame.altText} width={frame.width} height={frame.height} />
                  {frame.note && <p>{frame.note}</p>}
                  {results && <p>{describeFrame(visualization, results, frames.indexOf(frame), { detail })}</p>}
                </Card>
              </li>
            ))}
          </ul>
          <Button onClick={tryAgain}>Try this comparison again</Button>
        </div>
      )}
    </div>
  )
}
