// The page behind /jukebox.html (dev.tsx): ask a question or press a demo button, call the orchestrator, play the answer with its
// descriptions. With no server, the offline box plays a pasted answer. A model's text is shown only where this file says so.

import { useRef, useState } from 'react'
import { Button, Notice, useAnnounce } from '../../components'
import { generateJukebox, MAX_QUERY_CHARS, type JukeboxErrorKind, type JukeboxRequest } from './generate'
import { JukeboxPlayer } from './JukeboxPlayer'
import { parseAudioPayload, parseVisionPayload, type AudioPayload, type VisionPayload } from './payload'

/** Example questions for this development page. They are not a data set's details. */
const DEMOS = [
  { label: 'Demo: Arctic sea ice', query: 'How did Arctic sea ice change between September 2012 and September 2020?' },
  { label: 'Demo: Amazon smoke', query: 'Show the smoke from the Amazon fires in August 2019.' },
]

/** A made-up answer, so the offline box plays something with descriptions before anything is pasted. */
const SAMPLE = JSON.stringify(
  {
    audio: {
      base_bpm: 120,
      tracks: [
        { instrument: 'marimba', pitch_range: [60, 72], volume_curve: [0.2, 0.3, 0.45, 0.6, 0.8, 1, 0.8, 0.6, 0.45, 0.3, 0.2, 0, 0.5, 0.7, 0.9, 0.7] },
        { instrument: 'bass drone', pitch_range: [36, 43], volume_curve: [0.6, 0, 0.6, 0, 0.8, 0, 0.8, 0, 0.6, 0, 0.6, 0, 0.9, 0, 0.9, 0] },
      ],
    },
    vision: {
      descriptions: [
        { timestamp_sec: 0, alt_text: 'A calm, pale blue sea with a few thin streaks of white.', intensity_level: 'low' },
        { timestamp_sec: 1.5, alt_text: 'The white patches spread and join into a wide sheet.', intensity_level: 'medium' },
        { timestamp_sec: 3, alt_text: 'A dense white sheet covers most of the view.', intensity_level: 'high' },
      ],
    },
  },
  null,
  2,
)

const ERRORS: Record<JukeboxErrorKind, string> = {
  rate: 'Too many requests just now. Wait a moment, then try again.',
  model: 'The orchestrator could not finish this one. Try again, or ask in a different way.',
  off: 'The Jukebox is switched off on this server.',
  unreachable: 'The server could not be reached. Is it running? You can still try the offline demo below.',
}

/** The message for an error, with the server's wait when it gave one. */
function errorText(error: JukeboxErrorKind, retryAfter?: number): string {
  if (error === 'rate' && retryAfter) return `Too many requests just now. Try again in about ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`
  return ERRORS[error]
}

type Answer = { audio: AudioPayload; vision: VisionPayload | null; approved: boolean; feedback: string }

function readOffline(text: string): Answer | null {
  try {
    const value: unknown = JSON.parse(text)
    const audio = parseAudioPayload(value)
    return audio ? { audio, vision: parseVisionPayload(value), approved: true, feedback: '' } : null
  } catch {
    return null
  }
}

export function JukeboxStudio() {
  const announce = useAnnounce()
  const [query, setQuery] = useState('')
  const [contrast, setContrast] = useState<JukeboxRequest['contrast']>('high')
  const [detailLevel, setDetailLevel] = useState<JukeboxRequest['detailLevel']>('verbose')
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<{ kind: JukeboxErrorKind; retryAfter?: number } | null>(null)
  const [nothing, setNothing] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [offlineText, setOfflineText] = useState(SAMPLE)
  /** The request to send again on Retry. */
  const last = useRef<JukeboxRequest | null>(null)
  /** Goes up on every send, so an old answer that arrives late is dropped. */
  const sent = useRef(0)

  async function send(request: JukeboxRequest) {
    last.current = request
    const mine = (sent.current += 1)
    setWaiting(true)
    setError(null)
    setNothing(false)
    setAnswer(null)
    const result = await generateJukebox(request)
    if (sent.current !== mine) return
    setWaiting(false)
    if (result.kind === 'error') {
      setError({ kind: result.error, retryAfter: result.retryAfter })
      announce(errorText(result.error, result.retryAfter))
    } else if (result.kind === 'nothing') setNothing(true)
    else setAnswer(result.answer)
  }

  const request = (text: string): JukeboxRequest => ({ query: text.trim(), contrast, detailLevel })
  const offline = readOffline(offlineText)

  return (
    <main className="jukebox-studio">
      <h1>Jukebox studio</h1>
      <form
        className="jukebox-studio__form"
        onSubmit={event => {
          event.preventDefault()
          if (query.trim()) void send(request(query))
        }}
      >
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="jukebox-query">Your question</label>
          <input
            id="jukebox-query"
            className="ui-input"
            name="query"
            value={query}
            maxLength={MAX_QUERY_CHARS}
            disabled={waiting}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <div className="jukebox-studio__row">
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="jukebox-contrast">Contrast</label>
            <select id="jukebox-contrast" className="ui-select" value={contrast} disabled={waiting} onChange={event => setContrast(event.target.value === 'low' ? 'low' : 'high')}>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="jukebox-detail">Detail</label>
            <select id="jukebox-detail" className="ui-select" value={detailLevel} disabled={waiting} onChange={event => setDetailLevel(event.target.value === 'brief' ? 'brief' : 'verbose')}>
              <option value="verbose">Verbose</option>
              <option value="brief">Brief</option>
            </select>
          </div>
        </div>
        <div className="jukebox-studio__row">
          <Button type="submit" variant="primary" size="medium" disabled={waiting || !query.trim()}>Make music</Button>
          {DEMOS.map(demo => (
            <Button
              key={demo.label}
              disabled={waiting}
              onClick={() => {
                setQuery(demo.query)
                void send(request(demo.query))
              }}
            >
              {demo.label}
            </Button>
          ))}
        </div>
      </form>

      {waiting && <p role="status">Orchestrating NASA data and auditing accessibility...</p>}
      {error && (
        <Notice variant="error" action={{ label: 'Retry', onClick: () => last.current && void send(last.current), disabled: waiting }}>
          {errorText(error.kind, error.retryAfter)}
        </Notice>
      )}
      {nothing && <Notice variant="info">No data was found for that question, so nothing was made. Try another question.</Notice>}
      {answer && (
        <>
          {!answer.approved && (
            <Notice variant="warning">
              The accessibility check did not approve this result. It may be missing descriptions or be hard to follow.
              {answer.feedback && (
                <details>
                  <summary>Details (written by a model)</summary>
                  <p>{answer.feedback}</p>
                </details>
              )}
            </Notice>
          )}
          <JukeboxPlayer payload={answer.audio} vision={answer.vision} />
        </>
      )}

      <details>
        <summary>Load Raw JSON Payload (Offline Demo Mode)</summary>
        <div className="ui-field">
          <label className="ui-field__label" htmlFor="jukebox-offline">The answer of the route, or its audio field, as JSON</label>
          <textarea
            id="jukebox-offline"
            className="ui-textarea"
            name="payload"
            value={offlineText}
            spellCheck={false}
            onChange={event => setOfflineText(event.target.value)}
          />
        </div>
        {offline ? <JukeboxPlayer payload={offline.audio} vision={offline.vision} /> : <Notice variant="error">This is not an audio payload.</Notice>}
      </details>
    </main>
  )
}
