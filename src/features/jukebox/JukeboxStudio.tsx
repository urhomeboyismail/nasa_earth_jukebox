// The page behind /jukebox.html (dev.tsx): ask a question or press a demo button, call the orchestrator, play the answer with its
// descriptions. With no server, the offline box plays a pasted answer. A model's text is shown only where this file says so.
// G11: "Fetch live data" asks Echo instead. The server fetches the series from Planetary Computer; Echo's face follows the request, and
// its reply (built from the numbers on the server, not model text) is shown, announced, and played by the same player.

import { lazy, Suspense, useRef, useState, type CSSProperties } from 'react'
import { Button, Notice, useAnnounce } from '../../components'
import type { MascotExpression, MascotPose } from '../../components/mascotTypes'
import { loadCatalog, type CatalogEntry } from '../../data'
import { hashFor } from '../../route'
import { generateJukebox, MAX_QUERY_CHARS, type JukeboxErrorKind, type JukeboxRequest } from './generate'
import { JukeboxPlayer } from './JukeboxPlayer'
import { queryMascot, type AudioPreference, type DatasetTheme, type MascotAnswer } from './mascotQuery'
import { parseAudioPayload, parseVisionPayload, type AudioPayload, type VisionPayload } from './payload'
import { SeriesTable } from './SeriesTable'

// The 3D robot loads its own scripts; this page only needs it once Echo is shown.
const Ixia = lazy(() => import('../mascot/Ixia'))

/** Echo's accent for each kind of data: generic themes from the server, mapped to the design tokens. */
const THEME_ACCENT: Record<DatasetTheme, string> = {
  ocean: 'var(--md-sys-color-tertiary)',
  atmosphere: 'var(--md-sys-color-primary)',
  forest: 'var(--md-sys-color-secondary)',
  default: 'var(--md-sys-color-primary)',
}

type CssVars = CSSProperties & Record<`--${string}`, string>

type Live = { waiting: boolean; answer: MascotAnswer | null; error: { kind: JukeboxErrorKind; retryAfter?: number } | null }

/** Echo's face and gesture for the live request. */
function echoFor(live: Live): { expression: MascotExpression; pose: MascotPose } {
  if (live.waiting) return { expression: 'searching', pose: 'thinking' }
  if (live.error) return { expression: 'alert', pose: 'idle' }
  if (!live.answer) return { expression: 'happy', pose: 'idle' }
  if (live.answer.audio) return { expression: 'eq_active', pose: 'talking' }
  return { expression: live.answer.localId ? 'happy' : 'alert', pose: 'talking' }
}

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
  const [preference, setPreference] = useState<AudioPreference>('normal')
  const [live, setLive] = useState<Live>({ waiting: false, answer: null, error: null })
  /** WX02: the step of Echo's sound being heard, marked in "Show the numbers". */
  const [liveStep, setLiveStep] = useState<number | null>(null)
  const catalog = useRef<Promise<CatalogEntry[]> | null>(null)
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
    setLive({ waiting: false, answer: null, error: null })
    const result = await generateJukebox(request)
    if (sent.current !== mine) return
    setWaiting(false)
    if (result.kind === 'error') {
      setError({ kind: result.error, retryAfter: result.retryAfter })
      announce(errorText(result.error, result.retryAfter))
    } else if (result.kind === 'nothing') setNothing(true)
    else setAnswer(result.answer)
  }

  async function fetchLive(prompt: string) {
    const mine = (sent.current += 1)
    setWaiting(true)
    setError(null)
    setNothing(false)
    setAnswer(null)
    setLive({ waiting: true, answer: null, error: null })
    // The app's data sets go with the question; without the catalog the question still goes.
    catalog.current ??= loadCatalog().catch(() => [])
    const result = await queryMascot({ prompt, preference, catalog: await catalog.current })
    if (sent.current !== mine) return
    setWaiting(false)
    if (result.kind === 'error') {
      setLive({ waiting: false, answer: null, error: { kind: result.error, retryAfter: result.retryAfter } })
      announce(errorText(result.error, result.retryAfter))
    } else {
      setLive({ waiting: false, answer: result.answer, error: null })
      announce(result.answer.reply)
    }
  }

  const request = (text: string): JukeboxRequest => ({ query: text.trim(), contrast, detailLevel })
  const echo = echoFor(live)
  const echoStyle: CssVars = { '--mascot-accent': THEME_ACCENT[live.answer?.theme ?? 'default'] }
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
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="jukebox-sound">Live data sound</label>
            <select
              id="jukebox-sound"
              className="ui-select"
              value={preference}
              disabled={waiting}
              onChange={event => setPreference(event.target.value === 'gentle' ? 'gentle' : event.target.value === 'bold' ? 'bold' : 'normal')}
            >
              <option value="gentle">Gentle</option>
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
            </select>
          </div>
        </div>
        <div className="jukebox-studio__row">
          <Button type="submit" variant="primary" size="medium" disabled={waiting || !query.trim()}>Make music</Button>
          <Button disabled={waiting || !query.trim()} onClick={() => void fetchLive(query.trim())}>
            Fetch live data (Planetary Computer)
          </Button>
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

      <div className="jukebox-studio__echo" style={echoStyle}>
        <Suspense fallback={null}>
          <Ixia expression={echo.expression} pose={echo.pose} say={live.answer?.reply ?? ''} />
        </Suspense>
      </div>
      {live.waiting && <p role="status">Echo is fetching live data from Planetary Computer...</p>}
      {waiting && !live.waiting && <p role="status">Orchestrating NASA data and auditing accessibility...</p>}
      {live.error && (
        <Notice variant="error" action={{ label: 'Retry', onClick: () => void fetchLive(query.trim()), disabled: waiting || !query.trim() }}>
          {errorText(live.error.kind, live.error.retryAfter)}
        </Notice>
      )}
      {live.answer && (
        <section aria-label="Echo's answer" className="jukebox-studio__reply">
          <p>{live.answer.reply}</p>
          {live.answer.localId && <a href={`index.html${hashFor('listen', { data: live.answer.localId })}`}>Open it in the app</a>}
          {live.answer.audio && <JukeboxPlayer payload={live.answer.audio} vision={null} onStep={setLiveStep} />}
          {live.answer.series && <SeriesTable series={live.answer.series} current={liveStep} />}
        </section>
      )}
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
