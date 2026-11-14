import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import type { FrameAnalysis } from '../../analysis'
import { playCue } from '../../audio/cues'
import { Button } from '../../components'
import { useAnnounce } from '../../components/useAnnounce'
import { useAssistantContext } from '../../assistant/context'
import type { Visualization } from '../../data'
import { dateFormatterFor } from '../../dates'
import type { AssistantAction } from '../../hooks/useVoiceAssistant'
import { pages } from '../../pages'
import { currentDataParam, hashFor } from '../../route'
import { sendPlayerCommand } from '../player/controls'
import { ask, availableQuestions, confidenceFor, guardsAllow, MAX_QUESTION_CHARS, type Answer } from './ask'
import { buildFacts } from './facts'
import { askAgent } from './remote'
import './ask.css'

type Props = {
  visualization: Visualization
  results: FrameAnalysis[]
}

type Mode = 'offline' | 'agent'
const MODE_TEXT: Record<Mode, string> = { offline: 'Answered offline', agent: 'Answered with AI, from checked facts' }

type Shown = Answer & { asked: string; mode: Mode; action: AssistantAction | null }

/**
 * "Ask about this data": cited answers made by rules from the analysed frames. A question the rules cannot match, and that no guard
 * refuses, goes to the server's agent (remote.ts), which may only choose from the same facts; the answer is rebuilt from the browser's
 * own fact text. Any failure gives the offline answer, so with no server the panel works as before. An action the agent suggests is a
 * button, never run by itself. The answer is shown and also said once through the page's polite announcer.
 */
export function AskPanel({ visualization, results }: Props) {
  const announce = useAnnounce()
  const inputId = useId()
  const facts = useMemo(() => buildFacts(visualization, results), [visualization, results])
  const dates = useMemo(() => visualization.frames.map(frame => frame.date), [visualization])
  const questions = useMemo(() => availableQuestions(facts), [facts])
  const when = useMemo(() => dateFormatterFor(dates), [dates])
  // G06: the voice guide reads the same facts (and the dates the data set has) through get_screen_context. Only sent while a voice
  // conversation is open, and cleared when the panel goes away. The server drops a fact over 400 characters, so a long one is cut here.
  useAssistantContext('facts', {
    knownDates: dates,
    facts: facts.map(({ id, kind, text }) => ({ id, kind, text: text.slice(0, 400) })),
  })
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<Shown | null>(null)
  const [working, setWorking] = useState(false)
  // Each question gets a number; an answer that arrives after a newer question is dropped.
  const latest = useRef(0)
  const pending = useRef<AbortController | null>(null)

  useEffect(() => {
    const counter = latest
    const request = pending
    return () => { counter.current += 1; request.current?.abort() }
  }, [])

  function show(result: Answer, asked: string, mode: Mode, action: AssistantAction | null = null) {
    setWorking(false)
    setAnswer({ ...result, asked, mode, action })
    playCue('answer')
    announce(`${result.answer}${result.matched ? ` ${result.confidence}.` : ''} ${MODE_TEXT[mode]}.`)
  }

  async function submit(question: string) {
    const id = ++latest.current
    pending.current?.abort()
    pending.current = null
    const asked = question.trim()
    const offline = ask(question, facts, dates)
    if (offline.matched || !guardsAllow(question, dates)) {
      show(offline, asked, 'offline')
      return
    }
    setAnswer(null)
    setWorking(false)
    const controller = new AbortController()
    pending.current = controller
    const sent = facts
    const remote = await askAgent(
      { question: asked, facts: sent, knownDates: dates },
      { onSlow: () => { if (id === latest.current) setWorking(true) }, signal: controller.signal },
    )
    if (id !== latest.current) return
    pending.current = null
    if (remote && remote.factIds.length && (remote.confidence === 'high' || remote.confidence === 'medium')) {
      const chosen = sent.filter(fact => remote.factIds.includes(fact.id))
      const ids = chosen.map(fact => fact.id)
      show({
        matched: true, answer: chosen.map(fact => fact.text).join(' '), factIds: ids,
        confidence: confidenceFor(chosen), source: `Source: ${ids.join(', ')}`,
      }, asked, 'agent', remote.action)
    } else {
      show(offline, asked, 'offline')
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void submit(text)
  }

  const action = answer?.action ?? null
  const agentDate = action?.action === 'player' && typeof action.command === 'object' ? action.command.setDate : undefined
  // Each date a cited fact is about becomes a button, so the evidence can be heard. The agent's own date button is not repeated.
  const citedDates = [...new Set(facts.filter(fact => answer?.factIds.includes(fact.id)).flatMap(fact => fact.date ?? []))]
    .filter(date => date !== agentDate)

  return (
    <section className="ask" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="ask__title">Ask about this data</h2>
      <form className="ask__form" onSubmit={onSubmit}>
        <label htmlFor={inputId}>Your question</label>
        <input id={inputId} type="text" value={text} maxLength={MAX_QUESTION_CHARS} aria-describedby={`${inputId}-privacy`}
          onChange={event => setText(event.target.value)} />
        <Button type="submit" variant="primary">Ask</Button>
      </form>
      <p id={`${inputId}-privacy`} className="ask__privacy">
        Questions the built-in answers do not match may be sent, with the facts for this data set, to Google's Gemini through the app's
        server. The app saves nothing.
      </p>
      <div role="group" aria-label="Questions you can ask" className="ask__questions">
        {questions.map(item => (
          <Button key={item.id} onClick={() => { setText(item.question); void submit(item.question) }}>{item.question}</Button>
        ))}
      </div>
      {/* The panel's own polite region (role="status"), not the page announcer: "Working…" is shown, not announced separately. */}
      <p className="ask__meta" role="status">{working ? 'Working…' : ''}</p>
      {answer && (
        <div className="ask__answer" role="region" aria-label="Answer" tabIndex={-1}>
          <p className="ask__asked">{answer.asked || 'No question'}</p>
          <p className="ask__text">{answer.answer}</p>
          {answer.matched && <p className="ask__meta">{answer.confidence}. {answer.source}</p>}
          <p className="ask__mode">{MODE_TEXT[answer.mode]}</p>
          {citedDates.length > 0 && (
            <div role="group" aria-label="Hear the cited dates" className="ask__questions">
              {citedDates.map(date => <Button key={date} onClick={() => sendPlayerCommand({ setDate: date })}>Play {when(date)}</Button>)}
            </div>
          )}
          {action?.action === 'navigate' && (
            <Button onClick={() => { window.location.hash = hashFor(action.page, { data: currentDataParam() }) }}>
              Go to {pages.find(page => page.id === action.page)?.title ?? action.page}
            </Button>
          )}
          {action?.action === 'player' && typeof action.command === 'object' && (
            <Button onClick={() => sendPlayerCommand(action.command)}>Play {action.command.setDate}</Button>
          )}
        </div>
      )}
    </section>
  )
}
