// The Live data page (G13): type a question, Echo fetches live data from Planetary Computer through the server
// (POST /api/v1/mascot/query) and answers with a reply, a sound, the numbers and pictures. The voice guide shows the same answer.
// With the server off or out of reach the page says so, and the rest of the app works as before.

import { useRef, useState, type FormEvent } from 'react'
import { Button, Notice, useAnnounce } from '../../components'
import { loadCatalog, type CatalogEntry } from '../../data'
import type { JukeboxErrorKind } from '../jukebox/generate'
import { LiveAnswer } from '../jukebox/LiveAnswer'
import { errorText } from '../jukebox/liveErrors'
import { MAX_PROMPT_CHARS, queryMascot, type AudioPreference, type MascotAnswer } from '../jukebox/mascotQuery'

/** Example questions to start from. They are live queries a visitor might type, not one of the app's data sets. */
const EXAMPLES = [
  'Sea surface temperature around Mauritius in June 2026',
  'Sentinel-2 over Antananarivo in September 2026',
]

type Result = { answer: MascotAnswer } | { error: JukeboxErrorKind; retryAfter?: number }

export default function LivePage() {
  const announce = useAnnounce()
  const [question, setQuestion] = useState('')
  const [preference, setPreference] = useState<AudioPreference>('normal')
  const [waiting, setWaiting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const catalog = useRef<Promise<CatalogEntry[]> | null>(null)
  /** The question to send again on Retry. */
  const last = useRef('')
  /** Goes up on every send, so an old answer that arrives late is dropped. */
  const sent = useRef(0)

  async function fetchLive(prompt: string) {
    last.current = prompt
    const mine = (sent.current += 1)
    setWaiting(true)
    setResult(null)
    // The app's data sets go with the question; without the catalog the question still goes.
    catalog.current ??= loadCatalog().catch(() => [])
    const reply = await queryMascot({ prompt, preference, catalog: await catalog.current })
    if (sent.current !== mine) return
    setWaiting(false)
    if (reply.kind === 'error') {
      setResult({ error: reply.error, retryAfter: reply.retryAfter })
      announce(errorText(reply.error, reply.retryAfter))
    } else {
      setResult({ answer: reply.answer })
      announce(reply.answer.reply)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (question.trim()) void fetchLive(question.trim())
  }

  return (
    <div className="jukebox-studio__form">
      <p>
        Ask about a place and a time. Echo fetches live satellite data from Microsoft Planetary Computer, then plays it as sound and
        shows the numbers and pictures behind it. You can ask the voice guide the same question.
      </p>
      <form className="jukebox-studio__form" onSubmit={submit}>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="live-question">Your question</label>
          <input id="live-question" className="ui-input" name="question" value={question} maxLength={MAX_PROMPT_CHARS}
            disabled={waiting} onChange={event => setQuestion(event.target.value)} />
        </div>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="live-sound">Live data sound</label>
          <select id="live-sound" className="ui-select" value={preference} disabled={waiting}
            onChange={event => setPreference(event.target.value === 'gentle' ? 'gentle' : event.target.value === 'bold' ? 'bold' : 'normal')}>
            <option value="gentle">Gentle</option>
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>
        <div className="jukebox-studio__row">
          <Button type="submit" variant="primary" size="medium" disabled={waiting || !question.trim()}>Fetch live data</Button>
        </div>
      </form>
      <div className="jukebox-studio__row" role="group" aria-label="Example questions">
        {EXAMPLES.map(example => (
          <Button key={example} disabled={waiting} onClick={() => { setQuestion(example); void fetchLive(example) }}>{example}</Button>
        ))}
      </div>
      {waiting && <p role="status">Fetching live data from Planetary Computer…</p>}
      {result && 'error' in result && (
        <Notice variant="error" action={{ label: 'Retry', onClick: () => void fetchLive(last.current), disabled: waiting }}>
          {errorText(result.error, result.retryAfter)}
        </Notice>
      )}
      {result && 'answer' in result && <LiveAnswer answer={result.answer} />}
    </div>
  )
}
