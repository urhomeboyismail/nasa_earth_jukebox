import { useId, useMemo, useState, type FormEvent } from 'react'
import type { FrameAnalysis } from '../../analysis'
import { Button } from '../../components'
import { useAnnounce } from '../../components/useAnnounce'
import type { Visualization } from '../../data'
import { ask, availableQuestions, MAX_QUESTION_CHARS, type Answer } from './ask'
import { buildFacts } from './facts'
import './ask.css'

type Props = {
  visualization: Visualization
  results: FrameAnalysis[]
}

/**
 * "Ask about this data": cited answers made by rules from the analysed frames. Nothing is sent anywhere, and a question the data
 * cannot answer gets "Not in this record." The answer is shown and also said once through the page's polite announcer.
 */
export function AskPanel({ visualization, results }: Props) {
  const announce = useAnnounce()
  const inputId = useId()
  const facts = useMemo(() => buildFacts(visualization, results), [visualization, results])
  const dates = useMemo(() => visualization.frames.map(frame => frame.date), [visualization])
  const questions = useMemo(() => availableQuestions(facts), [facts])
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState<(Answer & { asked: string }) | null>(null)

  function submit(question: string) {
    const result = ask(question, facts, dates)
    setAnswer({ ...result, asked: question.trim() })
    announce(`${result.answer}${result.matched ? ` ${result.confidence}.` : ''}`)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit(text)
  }

  return (
    <section className="ask" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="ask__title">Ask about this data</h2>
      <form className="ask__form" onSubmit={onSubmit}>
        <label htmlFor={inputId}>Your question</label>
        <input id={inputId} type="text" value={text} maxLength={MAX_QUESTION_CHARS} onChange={event => setText(event.target.value)} />
        <Button type="submit" variant="primary">Ask</Button>
      </form>
      <div role="group" aria-label="Questions you can ask" className="ask__questions">
        {questions.map(item => (
          <Button key={item.id} onClick={() => { setText(item.question); submit(item.question) }}>{item.question}</Button>
        ))}
      </div>
      {answer && (
        <div className="ask__answer" role="region" aria-label="Answer" tabIndex={-1}>
          <p className="ask__asked">{answer.asked || 'No question'}</p>
          <p className="ask__text">{answer.answer}</p>
          {answer.matched && <p className="ask__meta">{answer.confidence}. {answer.source}</p>}
        </div>
      )}
    </section>
  )
}
