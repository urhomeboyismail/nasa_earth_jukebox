import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { analyzeAll, type FrameAnalysis } from '../../analysis'
import { useFrameAnalysis } from '../../analysis/useFrameAnalysis'
import { hasChange } from '../../analysis/available'
import { playCue } from '../../audio/cues'
import { useSoundEngine } from '../../audio/useSoundEngine'
import { styleFor, useSoundStyle } from '../../audio/style'
import { panFor } from '../../audio/pan'
import { voicingFor } from '../../audio/voicing'
import { useAssistantContext } from '../../assistant/context'
import { Button, ButtonGroup, Card, LoadingIndicator, Notice, RangeSlider, RegionPicker } from '../../components'
import { useRegionChoice } from '../../components/useRegionChoice'
import { ANNOUNCE_GAP_MS } from '../../components/announceRate'
import { useAnnounce } from '../../components/useAnnounce'
import { higherPhrase, regionFor, variableWords, type Frame, type Visualization } from '../../data'
import { describeFrame } from '../../describe'
import { deltaBetween, describeDelta } from '../../describe/compare'
import { useDescriptionDetail } from '../../describe/detail'
import { dateFormatterFor } from '../../dates'
import type { PageProps } from '../types'
import './compare.css'
import './test-mode.css'
import { answerText, baselineName, categoryLabel, changeStepLabel, judge, type Answer } from './judge'
import TestMode from './TestMode'
import { Fusion } from './Fusion'
import { isOceanView } from '../ocean/useOceanTracks'
import { currentDataParam, hashFor } from '../../route'

// EIC06: two dates of an ECCO2 ocean track, loaded only when #compare?ocean=1 is opened.
const OceanCompare = lazy(() => import('../ocean/OceanCompare'))

const CUSTOM = 'custom'
/** How long each of the two notes of "Hear the change" lasts. */
const CHANGE_NOTE_MS = 700

/** Listening-test mode is open only when the address is #compare?test=1. The App reads that once and passes it down. */
export default function ComparePage({ visualization, testMode = false }: PageProps) {
  if (!testMode && isOceanView()) return <Suspense fallback={<LoadingIndicator label="Loading the ocean tracks…" />}><OceanCompare /></Suspense>
  if (!visualization) return <p>Loading the data…</p>
  if (testMode) return <TestMode key={visualization.id} visualization={visualization} />
  return (
    <>
      <CompareModes key={visualization.id} visualization={visualization} />
      <p><a href={hashFor('compare', { data: currentDataParam(), ocean: '1' })}>Compare two dates of an ocean video track (ECCO2)</a></p>
    </>
  )
}

type Mode = 'dates' | 'sets'
const MODES = [{ value: 'dates', label: 'Two dates' }, { value: 'sets', label: 'Two data sets' }] as const

/** Two dates of this data set, or this data set with one it is paired with (fusion, blueprint §3.2). */
function CompareModes({ visualization }: { visualization: Visualization }) {
  const [mode, setMode] = useState<Mode>('dates')
  return (
    <>
      <ButtonGroup type="connected" legend="Compare" options={MODES} value={mode} onChange={setMode} />
      {mode === 'dates' ? <Compare visualization={visualization} /> : <Fusion visualization={visualization} />}
    </>
  )
}

function Compare({ visualization }: { visualization: Visualization }) {
  const { frames, comparisons, regions, mapping } = visualization
  const words = variableWords(visualization.variable)
  const announce = useAnnounce()
  const changeAvailable = hasChange(visualization)
  const formatDate = useMemo(() => dateFormatterFor(frames.map(frame => frame.date)), [frames])

  const [choice, setChoice] = useState(comparisons[0]?.id ?? CUSTOM)
  const [customA, setCustomA] = useState(frames[0].id)
  const [customB, setCustomB] = useState(frames[frames.length - 1].id)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [playError, setPlayError] = useState('')

  const { engine, engineError } = useSoundEngine(mapping)

  // F48: a ready-made comparison is played in its own region; the listener's own two dates use the region chosen here (region=<id> in the address).
  const preset = comparisons.find(c => c.id === choice)
  const [chosenRegion, chooseRegion] = useRegionChoice(visualization)
  const region = preset ? regionFor(visualization, preset.regionId) : chosenRegion

  const frameAId = preset ? preset.frameA : customA
  const frameBId = preset ? preset.frameB : customB
  // A ready-made comparison can name a date the data set does not have; the page then says so instead of crashing.
  const frameA = frames.find(f => f.id === frameAId)
  const frameB = frames.find(f => f.id === frameBId)

  // UI10: both dates read in every region, for the summary of what changed. Declared before the page's own analysis, so that stays the last read.
  const regionResults = useRegionResults(visualization, frameA, frameB)

  // With a baseline each result also carries its change step.
  const analysis = useFrameAnalysis(visualization, region, { withChange: changeAvailable })
  const { error: analysisError } = analysis
  // Until the region in use has been read, the results of the one before are not used.
  const results = analysis.results?.[0]?.regionId === region.id ? analysis.results : null

  const [chosenStyle, setSoundStyle] = useSoundStyle()
  // A remembered "change" is not used for a data set with no baseline.
  const soundStyle = styleFor(chosenStyle, changeAvailable)
  const changeOn = soundStyle === 'change'
  const [detail] = useDescriptionDetail()
  useEffect(() => { engine?.setStyle(soundStyle) }, [engine, soundStyle])

  // Silence the sounds when leaving the page.
  useEffect(() => () => engine?.stop(), [engine])

  // The button that was pressed disappears on reveal and on "try again", so focus has to be put somewhere sensible.
  // Changing a dropdown after a reveal must not move focus, so only those two actions do it.
  const resultRef = useRef<HTMLDivElement>(null)
  const playRef = useRef<HTMLDivElement>(null)

  // The shared scrubber sets the same two dates as the choosers. Its handles never cross, so if the choosers put B before A the
  // handles are named the other way round and still say which deck they set.
  const indexA = Math.max(0, frames.findIndex(f => f.id === customA))
  const indexB = Math.max(0, frames.findIndex(f => f.id === customB))
  const swapped = indexA > indexB
  const scrubber: { swapped: boolean; value: [number, number]; labels: [string, string] } = swapped
    ? { swapped, value: [indexB, indexA], labels: ['Date B', 'Date A'] }
    : { swapped, value: [indexA, indexB], labels: ['Date A', 'Date B'] }
  const resultA = results?.find(r => r.frameId === frameAId)
  const resultB = results?.find(r => r.frameId === frameBId)

  // For a ready-made comparison the data says what the right answer is; for the listener's own dates, the analysis does.
  // In the change style the question is about the change from normal, so the analysis answers it; a ready-made comparison's answer is about the temperature.
  const correct: Answer | null = preset && !changeOn ? preset.answer : judge(resultA, resultB, mapping)
  const canAnswer = correct !== null
  const ready = !!engine && !!results

  useAssistantContext(
    'compare',
    { frameA: frameAId, frameB: frameBId, answered: answer !== null, revealed, testInProgress: false },
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
    if (!engine || !results || !result) return
    try {
      await engine.unlock()
      engine.stop()
      // The cue comes before the date and finishes first, so it is never heard as part of the data.
      const cueMs = playCue(which === 'A' ? 'compareA' : 'compareB')
      if (cueMs) await new Promise(resolve => window.setTimeout(resolve, cueMs + 60))
      if (changeOn) {
        // The change bed of this date alone: the step and how far into it the date is. A date with no change to read plays the hiss.
        if (result.category === 'insufficient' || !result.changeStep || result.changeStep === 'insufficient') engine.playMissing()
        else {
          engine.playSequence([{
            category: result.category, atMs: 0, changeStep: result.changeStep, ...(result.medianChange !== undefined && { medianChange: result.medianChange }),
          }], () => {}, { tick: false })
        }
      } else if (result.category === 'insufficient') engine.playMissing()
      else {
        // The chord, without the slide or bell: the two dates are not neighbours in a run.
        const pad = voicingFor(results, results.indexOf(result), mapping).pad
        if (pad) engine.playCategory(result.category, { pad })
        else engine.playCategory(result.category)
      }
      setPlayError('')
      announce(`Played date ${which}.`)
    } catch (error) {
      setPlayError(error instanceof Error ? error.message : String(error))
    }
  }

  // UI10: what changed from A to B. A ready-made comparison keeps it back until the reveal, since it would give the answer away.
  const delta = regionResults ? deltaBetween(visualization, regionResults.a, regionResults.b) : null
  const summary = regionResults ? describeDelta(visualization, regionResults.a, regionResults.b, { detail }) : ''
  const showSummary = summary !== '' && (!preset || revealed)
  // Announced when either of the listener's own dates changes, but only once the date's own message has had its turn (one announcer gap) and the
  // listener has stopped moving it. After a ready-made comparison's reveal it is shown and not announced, so it does not talk over the result.
  useEffect(() => {
    if (!showSummary || preset) return
    const timer = window.setTimeout(() => announce(summary), ANNOUNCE_GAP_MS + 100)
    return () => window.clearTimeout(timer)
  }, [showSummary, preset, summary, announce])

  // The two notes of "Hear the change": the region that changed most, date A then date B, in the place it is on the map. The second one
  // is cancelled if the dates change or the page closes before it sounds.
  const changeTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(changeTimer.current), [engine, frameAId, frameBId])
  async function hearChange() {
    const top = delta?.top
    if (!engine || !top) return
    try {
      await engine.unlock()
      engine.stop()
      window.clearTimeout(changeTimer.current)
      const pan = panFor(top.region)
      engine.playCategory(top.from.category, { pan, durationMs: CHANGE_NOTE_MS })
      changeTimer.current = window.setTimeout(() => engine.playCategory(top.to.category, { pan, durationMs: CHANGE_NOTE_MS }), CHANGE_NOTE_MS + 200)
      setPlayError('')
      announce(`Played ${top.region.name}: date A, then date B.`)
    } catch (error) {
      setPlayError(error instanceof Error ? error.message : String(error))
    }
  }

  const right = answer !== null && answer === correct
  const baseline = (visualization).baseline
  const explanation = !frameA || !frameB ? '' : changeOn
    ? (correct ? `${formatDate(frameA.date)} was ${changeStepLabel(resultA)} and ${formatDate(frameB.date)} was ${changeStepLabel(resultB)}, measured against ${baselineName(baseline)}.` : '')
    : preset?.explanation ??
      (correct ? `${formatDate(frameA.date)} sounded ${categoryLabel(resultA, mapping)} and ${formatDate(frameB.date)} sounded ${categoryLabel(resultB, mapping)}.` : '')

  function reveal() {
    engine?.stop()
    setRevealed(true)
    announce(`${right ? 'Correct.' : 'Not quite.'} ${correct ? `${answerText(correct, changeOn, words)}.` : ''} ${explanation}`)
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
      {!results && !analysisError && !engineError && <LoadingIndicator label="Analyzing the images…" />}
      {playError && <Notice variant="error">The sound could not be played. {playError}</Notice>}

      <div className="compare__choose">
        <label htmlFor="compare-choice" className="compare__label">Comparison</label>
        <select id="compare-choice" className="ui-select" value={choice} onChange={event => choose(event.target.value)}>
          {comparisons.map((c, i) => <option key={c.id} value={c.id}>{`Comparison ${i + 1}`}</option>)}
          <option value={CUSTOM}>Choose my own two dates</option>
        </select>
      </div>

      {!preset && (
        <div className="compare__dates">
          <RegionPicker
            regions={regions}
            value={chosenRegion.id}
            onChange={id => { engine?.stop(); chooseRegion(id); setAnswer(null); setRevealed(false); announce(`Region: ${regions.find(r => r.id === id)?.name ?? id}.`) }}
          />
          {([['a', 'Date A', frameAId], ['b', 'Date B', frameBId]] as const).map(([which, label, value]) => (
            <div key={which} className="compare__choose">
              <label htmlFor={`compare-date-${which}`} className="compare__label">{label}</label>
              <select id={`compare-date-${which}`} className="ui-select" value={value} onChange={event => pickDate(which, event.target.value)}>
                {frames.map(f => <option key={f.id} value={f.id}>{formatDate(f.date)}</option>)}
              </select>
            </div>
          ))}
          {frames.length > 1 && (
            <div className="compare__scrubber">
              <RangeSlider
                labels={scrubber.labels}
                value={scrubber.value}
                min={0}
                max={frames.length - 1}
                describe={index => formatDate(frames[index].date)}
                onChange={(next, thumb) => {
                  // The handles keep their order, so the low one is deck B's when the choosers put B before A.
                  const which = (thumb === 0) !== scrubber.swapped ? 'a' : 'b'
                  pickDate(which, frames[next[thumb]].id)
                  announce(`Date ${which.toUpperCase()}: ${formatDate(frames[next[thumb]].date)}.`, { busy: true })
                }}
              />
            </div>
          )}
        </div>
      )}

      {changeAvailable && (
        <div className="compare__style">
          <Button pressed={changeOn} onClick={() => setSoundStyle(changeOn ? 'full' : 'change')}>Change from normal</Button>
          <span>Hear how far each date is from its normal, not the value itself.</span>
        </div>
      )}

      {!frameA || !frameB ? (
        <Notice>This comparison names a date that is not in the data set. Choose another comparison.</Notice>
      ) : (
      <>
      <p className="compare__question">
        {changeOn ? 'Which date is further above its normal?' : (preset?.question ?? `Which date shows ${higherPhrase(words)}?`)}
      </p>
      {regions.length > 1 && <p className="compare__region">Region: {region.name}</p>}

      <div className="compare__decks" ref={playRef}>
        {(['A', 'B'] as const).map(which => (
          <div key={which} className="compare__deck compare-glass">
            <span className="compare__deck-label">Deck {which}</span>
            {/* A ready-made comparison keeps its dates (and so its season) hidden until the reveal, like its pictures. */}
            {(!preset || revealed) && <span className="compare__deck-date">{formatDate((which === 'A' ? frameA : frameB).date)}</span>}
            <Button variant="primary" disabled={!ready} onClick={() => void playDate(which)}>Play date {which}</Button>
          </div>
        ))}
      </div>

      {showSummary && (
        <Card title="What changed" headingLevel={2}>
          <p>{summary}</p>
          <Button disabled={!engine || !delta?.top} onClick={() => void hearChange()}>Hear the change</Button>
        </Card>
      )}

      {!canAnswer && ready && !preset && (
        <Notice>One of these dates has no usable data, so there is no right answer. Choose two other dates.</Notice>
      )}

      <fieldset className="compare__answer" disabled={revealed || !canAnswer}>
        <legend>Your answer</legend>
        {([['a', changeOn ? 'A is further above' : `A is ${words.higher}`], ['b', changeOn ? 'B is further above' : `B is ${words.higher}`], ['same', 'About the same']] as const).map(([value, label]) => (
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
            {correct && `${answerText(correct, changeOn, words)}.`} {explanation}
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
      </>
      )}
    </div>
  )
}

/** Dates A and B read in every region of the data set, or null while they are being read (or if they cannot be). Results of other dates are not used. */
function useRegionResults(visualization: Visualization, frameA: Frame | undefined, frameB: Frame | undefined) {
  const { regions, colorScale, mapping } = visualization
  const [state, setState] = useState<{ a: Frame; b: Frame; results: FrameAnalysis[][] } | null>(null)
  useEffect(() => {
    if (!frameA || !frameB) return
    let cancelled = false
    Promise.all(regions.map(region => analyzeAll([frameA, frameB], region, colorScale, mapping)))
      .then(results => { if (!cancelled) setState({ a: frameA, b: frameB, results }) })
      .catch(() => { if (!cancelled) setState(null) })
    return () => { cancelled = true }
  }, [regions, colorScale, mapping, frameA, frameB])
  if (!state || state.a !== frameA || state.b !== frameB) return null
  const of = (frame: Frame) => state.results.flatMap(perRegion => perRegion.filter(result => result.frameId === frame.id))
  return { a: of(state.a), b: of(state.b) }
}
