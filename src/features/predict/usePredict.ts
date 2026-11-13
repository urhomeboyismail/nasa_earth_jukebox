// Predict, then hear (ticket IX05). The listener hears a date, answers one question about the next two, then hears those two dates and the answer.
// The right answer is computed from SN01's features of the date and the two after it (read in order, so the hot-spot ids follow the same spot). It is kept
// in memory and never put on the page until the reveal. Pressing Predict is what starts any sound (WCAG 1.4.2); Escape or Stop silences it.
//
// State changes happen in presses, in timer callbacks and after a read finishes, never synchronously in an effect. The timers live in a ref.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractFeatures, type FrameFeatures } from '../../analysis/features'
import { baseInput, baselineFor, defaultLoadPixels } from '../../analysis/video/input'
import type { Ensemble } from '../../audio/ensemble/types'
import { useAnnounce } from '../../components'
import type { Frame, Visualization } from '../../data'
import { noteForPosition, notesOf } from '../../interaction/notes'
import { useActionHandler } from '../../interaction/registry'
import { presetFor, toMusicFrame } from '../../sonify'
import { onPredictRequest, reportPredictDone } from './bus'
import { answerFor, questionsFor, revealText, type Question } from './judge'

/** How long the question's sound lasts, and how long each of the two later dates sounds (the second starts when the first ends). */
export const QUESTION_SECONDS = 1.5
export const DATE_SECONDS = 0.8
export const DATE_GAP_MS = 800
/** The two notes of the answer, and the time between them. */
const ANSWER_LEVEL = 0.5
const ANSWER_SECONDS = 0.35
const ANSWER_GAP_MS = 300
const RIGHT_POSITIONS: [number, number] = [0.35, 0.7]
const WRONG_POSITIONS: [number, number] = [0.7, 0.35]

type Chain = { now: FrameFeatures; mid: FrameFeatures; later: FrameFeatures }
/** What is known about a date: the question to ask and the three frames behind it, or null when there is none. */
type Prepared = { question: Question; chain: Chain } | null

export type PredictPhase =
  | { status: 'idle' }
  | { status: 'asking'; index: number; question: Question; chain: Chain }
  | { status: 'revealing'; index: number; question: Question }
  | { status: 'done'; index: number; question: Question; text: string; correct: boolean }

export type PredictEnsemble = Pick<Ensemble, 'playNotes' | 'now' | 'status' | 'start' | 'stop'>

export type PredictFeatureReader = (visualization: Visualization, frame: Frame, previous?: FrameFeatures) => Promise<FrameFeatures>

type Options = {
  visualization: Visualization
  /** The date on screen: its question is prepared. */
  index: number
  ensemble: PredictEnsemble
  /** Stops playback before a question, so the music does not run over it. */
  halt: () => void
  /** Brings the asked date on screen. */
  showDate: (index: number) => void
  /** How a frame is read. For tests; the app's reader by default. */
  read?: PredictFeatureReader
}

const readFrame: PredictFeatureReader = async (visualization, frame, previous) => {
  const [pixels, baseline] = await Promise.all([defaultLoadPixels(frame.image), baselineFor(visualization, frame.date, defaultLoadPixels)])
  return extractFeatures(pixels, { ...baseInput(visualization, frame.id, frame.date, 1), baseline }, previous)
}

/** The date and the two after it, read in order so the hot spots keep their ids. Null when there are not two more dates, or a frame cannot be read. */
async function readChain(visualization: Visualization, index: number, read: PredictFeatureReader): Promise<Chain | null> {
  const { frames } = visualization
  if (index < 0 || index + 2 >= frames.length) return null
  try {
    const now = await read(visualization, frames[index])
    const mid = await read(visualization, frames[index + 1], now)
    const later = await read(visualization, frames[index + 2], mid)
    return { now, mid, later }
  } catch {
    return null
  }
}

export type Predict = ReturnType<typeof usePredict>

export function usePredict({ visualization, index, ensemble, halt, showDate, read = readFrame }: Options) {
  const announce = useAnnounce()
  const preset = useMemo(() => presetFor(visualization.sonification?.preset ?? 'major'), [visualization.sonification?.preset])
  const [phase, setPhase] = useState<PredictPhase>({ status: 'idle' })
  /** Each date's question (or null for none), by `<data set>:<index>`, for the buttons. A key that is missing has not been read yet. */
  const [questions, setQuestions] = useState<Record<string, Question | null>>({})
  /** Each date's reading, kept as it starts, so two askers share one read. */
  const store = useRef(new Map<string, Promise<Prepared>>())
  const timers = useRef<number[]>([])
  const keyOf = useCallback((i: number) => `${visualization.id}:${i}`, [visualization.id])

  const clearTimers = useCallback(() => {
    timers.current.forEach(timer => window.clearTimeout(timer))
    timers.current = []
  }, [])
  const after = useCallback((ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms))
  }, [])

  /** Reads what a date needs, once. Which question a date gets is fixed by the date, so reading again would change nothing. */
  const prepare = useCallback((i: number): Promise<Prepared> => {
    const key = keyOf(i)
    const kept = store.current.get(key)
    if (kept) return kept
    const reading = (async (): Promise<Prepared> => {
      const chain = await readChain(visualization, i, read)
      const asked = chain ? questionsFor(chain.now, chain.later) : []
      // One question per date, picked by the date's place in the data set: the same frames always give the same question.
      return chain && asked.length ? { question: asked[i % asked.length], chain } : null
    })()
    store.current.set(key, reading)
    void reading.then(result => setQuestions(before => ({ ...before, [key]: result?.question ?? null })))
    return reading
  }, [keyOf, read, visualization])

  // The date on screen is read as soon as it is shown, so its Predict button is there when the listener reaches it.
  useEffect(() => { void prepare(index) }, [index, prepare])

  const questionAt = useCallback((i: number): Question | null => questions[keyOf(i)] ?? null, [questions, keyOf])

  /** Escape, the Stop button, or a new question: silences the sound and drops the question. */
  const cancel = useCallback(() => {
    if (phase.status !== 'asking' && phase.status !== 'revealing') return
    clearTimers()
    ensemble.stop()
    setPhase({ status: 'idle' })
    reportPredictDone()
  }, [clearTimers, ensemble, phase.status])

  /** Starts a question for the date at `i`. Sound starts here, from the press. */
  const ask = useCallback(async (i: number) => {
    const ready = await prepare(i)
    if (!ready) { reportPredictDone(); return }
    clearTimers()
    halt()
    showDate(i)
    if (ensemble.status() !== 'on') await ensemble.start().catch(() => {})
    ensemble.playNotes(notesOf(toMusicFrame(ready.chain.now, preset), QUESTION_SECONDS))
    setPhase({ status: 'asking', index: i, question: ready.question, chain: ready.chain })
  }, [clearTimers, ensemble, halt, prepare, preset, showDate])

  const choose = useCallback((choiceId: string) => {
    if (phase.status !== 'asking') return
    const { index: at, question, chain } = phase
    const correct = answerFor(question, chain.now, chain.later)
    if (correct === null) return
    const text = revealText(question, choiceId, correct)
    const right = choiceId === correct
    setPhase({ status: 'revealing', index: at, question })
    clearTimers()
    // The two dates, in order. Each call sounds at once and lets go by itself.
    const nowMusic = toMusicFrame(chain.now, preset)
    const midMusic = toMusicFrame(chain.mid, preset, nowMusic)
    ensemble.playNotes(notesOf(midMusic, DATE_SECONDS))
    after(DATE_GAP_MS, () => ensemble.playNotes(notesOf(toMusicFrame(chain.later, preset, midMusic), DATE_SECONDS)))
    // Then the answer: two notes rising when it is right, falling when it is not, and the same in words, once.
    const [first, second] = right ? RIGHT_POSITIONS : WRONG_POSITIONS
    const note = (position: number) => [{ midi: noteForPosition(position, preset), level: ANSWER_LEVEL, seconds: ANSWER_SECONDS, pan: 0 }]
    after(2 * DATE_GAP_MS, () => {
      ensemble.playNotes(note(first))
      announce(text)
      setPhase({ status: 'done', index: at, question, text, correct: right })
      reportPredictDone()
    })
    after(2 * DATE_GAP_MS + ANSWER_GAP_MS, () => ensemble.playNotes(note(second)))
  }, [after, announce, clearTimers, ensemble, phase, preset])

  // Escape (and a two-finger tap, and the gamepad's B) stops the question or the reveal.
  useActionHandler('stopSpeech', cancel)

  // The scripted demo asks from the first date that has a question, and hears when it is answered.
  useEffect(() => onPredictRequest(() => {
    void (async () => {
      for (let i = 0; i + 2 < visualization.frames.length; i++) {
        if (await prepare(i)) { void ask(i); return }
      }
      reportPredictDone()
    })()
  }), [ask, prepare, visualization.frames.length])

  useEffect(() => clearTimers, [clearTimers])

  // Stable, so a caller can list them in an effect's dependencies.
  const prepareDate = useCallback((i: number) => { void prepare(i) }, [prepare])
  const askDate = useCallback((i: number) => { void ask(i) }, [ask])

  return { phase, questionAt, prepare: prepareDate, ask: askDate, choose, cancel }
}
