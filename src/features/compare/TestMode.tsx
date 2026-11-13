// Listening-test mode, opened only from #compare?test=1 (there is no link to it in the navigation).
// Steps: consent → who you are → images on or off → each comparison in a fixed order → thank you.
// The right answers are never shown here; this is a test, not practice.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { FrameAnalysis } from '../../analysis'
import { useFrameAnalysis } from '../../analysis/useFrameAnalysis'
import type { SoundEngine } from '../../audio'
import { useSoundEngine } from '../../audio/useSoundEngine'
import { useSoundStyle } from '../../audio/style'
import { voicingFor } from '../../audio/voicing'
import { useAssistantContext } from '../../assistant/context'
import { Button, Card, Notice } from '../../components'
import { primaryRegion, variableWords, type Comparison, type Visualization } from '../../data'
import { dateFormatterFor } from '../../dates'
import { StudyClient, type Participant, type StudyStatus } from './studyClient'

type Step = 'consent' | 'about' | 'images' | 'question' | 'thanks'
type Answer = 'a' | 'b' | 'same'

const COMMENT_LIMIT = 500

const PARTICIPANTS: { value: Participant; label: string }[] = [
  { value: 'sighted', label: 'I can see the screen' },
  { value: 'blind_low_vision', label: 'I am blind or have low vision' },
  { value: 'not_said', label: 'I would rather not say' },
]

const CONFIDENCE = [
  { value: 1, label: '1, not at all sure' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5, very sure' },
]

export default function TestMode({ visualization, client: given }: { visualization: Visualization; client?: StudyClient }) {
  const { comparisons, mapping } = visualization
  const words = variableWords(visualization.variable)
  const client = useMemo(() => given ?? new StudyClient(), [given])
  const [status, setStatus] = useState<StudyStatus>(() => client.status)
  useEffect(() => {
    const unsubscribe = client.subscribe(() => setStatus(client.status))
    return () => { unsubscribe(); if (!given) client.dispose() }
  }, [client, given])

  const [step, setStep] = useState<Step>('consent')
  const [agreed, setAgreed] = useState(false)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [screenReader, setScreenReader] = useState(false)
  const [showImages, setShowImages] = useState(false)
  const [index, setIndex] = useState(0)
  // G06: the voice guide is told a test is open, from the first screen until the thank-you, so it does not help with the questions.
  // It gets no dates and no answers: the frames are empty on purpose.
  useAssistantContext('compare', { frameA: '', frameB: '', answered: false, revealed: false, testInProgress: step !== 'thanks' })

  // Sound: the same engine and analysis as the Compare page.
  const { engine, engineError } = useSoundEngine(mapping)
  const { results, error: analysisError } = useFrameAnalysis(visualization, primaryRegion(visualization))
  const [soundStyle] = useSoundStyle()
  // The listening test plays full or simple only, until the 13 Nov decision on the "change" style (docs/PLAN.md §6.2).
  useEffect(() => { engine?.setStyle(soundStyle === 'change' ? 'full' : soundStyle) }, [engine, soundStyle])
  useEffect(() => () => engine?.stop(), [engine])

  // Move focus to each step's heading, but not on first load, so screen reader users know a new step began.
  const heading = useRef<HTMLHeadingElement>(null)
  const firstStep = useRef(true)
  useEffect(() => {
    if (!firstStep.current) heading.current?.focus()
    firstStep.current = false
  }, [step, index])

  function begin() {
    if (participant === null) return
    client.start({ participant, screenReader, sawImages: showImages })
    setStep('question')
  }

  function answered(response: Parameters<StudyClient['submit']>[0]) {
    client.submit(response)
    if (index + 1 < comparisons.length) setIndex(index + 1)
    else setStep('thanks')
  }

  return (
    <div className="test">
      <p className="test__badge">Listening test</p>
      {(engineError || analysisError) && <Notice variant="error">The sounds could not be prepared. {engineError || analysisError}</Notice>}

      {step === 'consent' && (
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); setStep('about') }} className="test__form">
          <h2 ref={heading} tabIndex={-1}>Before you start</h2>
          <p>We are testing whether people can hear changes in NASA Earth data by sound alone. You will listen to pairs of dates and say which one is {words.higher}. It takes about {Math.max(2, comparisons.length * 2)} minutes.</p>
          <ul className="test__list">
            <li>We keep your answers and how long you took. We do not ask for your name or email, and we do not store your IP address.</li>
            <li>It tests the app, not you. There are no wrong ways to find it hard, and we want to hear if you do.</li>
            <li>You can stop at any time by closing the page. Answers you have already given may stay in our results.</li>
          </ul>
          <label className="test__check">
            <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
            <span>I understand this, and I agree to take part.</span>
          </label>
          <Button type="submit" variant="primary" disabled={!agreed}>Continue</Button>
        </form>
      )}

      {step === 'about' && (
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); setStep('images') }} className="test__form">
          <h2 ref={heading} tabIndex={-1}>About you</h2>
          <fieldset>
            <legend>Which describes you best?</legend>
            {PARTICIPANTS.map(({ value, label }) => (
              <label key={value} className="test__option">
                <input type="radio" name="participant" value={value} checked={participant === value} onChange={() => setParticipant(value)} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <label className="test__check">
            <input type="checkbox" checked={screenReader} onChange={event => setScreenReader(event.target.checked)} />
            <span>I am using a screen reader right now.</span>
          </label>
          <Button type="submit" variant="primary" disabled={participant === null}>Continue</Button>
        </form>
      )}

      {step === 'images' && (
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); begin() }} className="test__form">
          <h2 ref={heading} tabIndex={-1}>Pictures</h2>
          <fieldset>
            <legend>Do you want to see the pictures as you listen?</legend>
            <label className="test__option">
              <input type="radio" name="images" checked={!showImages} onChange={() => setShowImages(false)} />
              <span>Audio only (recommended for this test)</span>
            </label>
            <label className="test__option">
              <input type="radio" name="images" checked={showImages} onChange={() => setShowImages(true)} />
              <span>Show the pictures too</span>
            </label>
          </fieldset>
          <Button type="submit" variant="primary">Start the test</Button>
        </form>
      )}

      {step === 'question' && (
        <Question
          key={comparisons[index].id}
          comparison={comparisons[index]}
          number={index + 1}
          of={comparisons.length}
          visualization={visualization}
          engine={engine}
          results={results}
          showImages={showImages}
          heading={heading}
          onDone={answered}
        />
      )}

      {step === 'thanks' && <Thanks status={status} client={client} heading={heading} />}
    </div>
  )
}

function Question({ comparison, number, of, visualization, engine, results, showImages, heading, onDone }: {
  comparison: Comparison
  number: number
  of: number
  visualization: Visualization
  engine: SoundEngine | null
  results: FrameAnalysis[] | null
  showImages: boolean
  heading: React.RefObject<HTMLHeadingElement | null>
  onDone: (response: { comparisonId: string; answer: Answer; correct: boolean; responseMs: number; confidence?: number; comment?: string }) => void
}) {
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const shownAt = useRef<number | null>(null)
  useEffect(() => { shownAt.current = performance.now() }, [])
  const formatDate = dateFormatterFor(visualization.frames.map(frame => frame.date))
  const words = variableWords(visualization.variable)
  // Only the pictures need these, and they are optional, so a missing date is said in words and the sounds still work.
  const frameA = visualization.frames.find(f => f.id === comparison.frameA)
  const frameB = visualization.frames.find(f => f.id === comparison.frameB)
  const ready = !!engine && !!results

  async function play(frameId: string) {
    const result = results?.find(r => r.frameId === frameId)
    if (!engine || !results || !result) return
    await engine.unlock()
    engine.stop()
    if (result.category === 'insufficient') engine.playMissing()
    else {
      // The chord, without the slide or bell: the two dates are not neighbours in a run.
      const pad = voicingFor(results, results.indexOf(result), visualization.mapping).pad
      if (pad) engine.playCategory(result.category, { pad })
      else engine.playCategory(result.category)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!answer) return
    engine?.stop()
    onDone({
      comparisonId: comparison.id,
      answer,
      correct: answer === comparison.answer,
      responseMs: Math.max(0, Math.round(performance.now() - (shownAt.current ?? performance.now()))),
      ...(confidence !== null && { confidence }),
      ...(comment.trim() && { comment: comment.trim() }),
    })
  }

  return (
    <form onSubmit={submit} className="test__form">
      <h2 ref={heading} tabIndex={-1}>Question {number} of {of}</h2>
      <p className="test__question">{comparison.question}</p>

      <div className="test__play">
        <Button variant="primary" disabled={!ready} onClick={() => void play(comparison.frameA)}>Play date A</Button>
        <Button variant="primary" disabled={!ready} onClick={() => void play(comparison.frameB)}>Play date B</Button>
      </div>

      {showImages && (!frameA || !frameB) && <Notice>A picture for this question is missing, but you can still listen and answer.</Notice>}
      {showImages && frameA && frameB && (
        <ul className="test__images">
          {([['Date A', frameA], ['Date B', frameB]] as const).map(([label, frame]) => (
            <li key={label}>
              <Card title={`${label}: ${formatDate(frame.date)}`} headingLevel={3}>
                <img src={frame.image} alt={frame.altText} width={frame.width} height={frame.height} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <fieldset>
        <legend>Which date is {words.higher}?</legend>
        {([['a', `A is ${words.higher}`], ['b', `B is ${words.higher}`], ['same', 'About the same']] as const).map(([value, label]) => (
          <label key={value} className="test__option">
            <input type="radio" name="answer" value={value} checked={answer === value} onChange={() => setAnswer(value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>How sure are you? (optional)</legend>
        {CONFIDENCE.map(({ value, label }) => (
          <label key={value} className="test__option">
            <input type="radio" name="confidence" value={value} checked={confidence === value} onChange={() => setConfidence(value)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="test__comment">
        <label htmlFor="test-comment">Anything you want to tell us about this one? (optional)</label>
        <textarea id="test-comment" rows={3} maxLength={COMMENT_LIMIT} value={comment} onChange={event => setComment(event.target.value)} />
        <span className="test__count">{comment.length} of {COMMENT_LIMIT} characters</span>
      </div>

      <Button type="submit" variant="primary" disabled={answer === null}>{number < of ? 'Submit and go to the next question' : 'Submit and finish'}</Button>
    </form>
  )
}

function Thanks({ status, client, heading }: { status: StudyStatus; client: StudyClient; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const [retrying, setRetrying] = useState(false)
  const waiting = status.pending > 0
  async function retry() {
    setRetrying(true)
    await client.flush()
    setRetrying(false)
  }
  return (
    <div className="test__form">
      <h2 ref={heading} tabIndex={-1}>Thank you</h2>
      <p>Thank you for taking part. Your answers help us find out whether this really works for people who cannot see the images.</p>
      {waiting && (
        <Notice>
          {status.pending === 1 ? '1 answer has' : `${status.pending} answers have`} not been sent yet. {status.problem} We keep trying. Please leave this page open.
          {' '}<Button disabled={retrying} onClick={() => void retry()}>Try sending now</Button>
        </Notice>
      )}
      {!waiting && status.rejected === 0 && <Notice>All {status.sent} of your answers were sent. Thank you.</Notice>}
      {status.rejected > 0 && (
        <Notice variant="error">
          {status.rejected === 1 ? '1 answer was' : `${status.rejected} answers were`} refused by the server and could not be saved. Please tell the team.
        </Notice>
      )}
    </div>
  )
}
