// The planet intro: on a first visit a full-screen planet turns with Echo standing on top, Echo asks your name, you say or type it,
// then the planet fades away and Home shows. Nothing sounds or speaks before the Start click. Typing always works; the microphone
// is an extra where the browser has speech recognition. shortcut: the page behind is not made inert, so Tab can leave the layer; do that if it matters.

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useAnnounce } from '../../components'
import OrbitGlobe from '../home/OrbitGlobe'
import { MASCOT_NAME } from '../welcome/lines'
import { hush, speak } from '../welcome/speak'
import { hasSpeechInput, listenForName } from './listenForName'
import { NAME_MAX, saveIntro } from './storage'
import './intro.css'

export const ASK_NAME = `Hi, I'm ${MASCOT_NAME}. What should I call you?`
export const FADE_MS = 900

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export default function Intro() {
  const announce = useAnnounce()
  const titleId = useId()
  const inputId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const stopListening = useRef<() => void>(() => {})
  const [started, setStarted] = useState(false)
  const [listening, setListening] = useState(false)
  const [name, setName] = useState('')
  const [line, setLine] = useState(ASK_NAME)
  const [hint, setHint] = useState('')
  const [leaving, setLeaving] = useState(false)

  useEffect(() => { heading.current?.focus() }, [])
  useEffect(() => () => { stopListening.current(); hush() }, [])

  function listen() {
    setHint('')
    setListening(true)
    stopListening.current = listenForName(heard => {
      setListening(false)
      if (heard) setName(heard)
      else setHint("I didn't catch that. You can type it.")
    })
  }

  async function start() {
    setStarted(true)
    await speak(ASK_NAME)
    if (hasSpeechInput()) listen()
  }

  function leave(given: string) {
    stopListening.current()
    setListening(false)
    const reply = given ? `Nice to meet you, ${given}!` : `Welcome aboard!`
    setLine(reply)
    announce(reply)
    if (started) void speak(reply)
    setLeaving(true)
    window.setTimeout(() => {
      saveIntro({ seen: true, ...(given && { name: given }) })
      window.setTimeout(() => document.querySelector<HTMLElement>('main h1')?.focus(), 0)
    }, reducedMotion() ? 0 : FADE_MS)
  }

  const submit = (event: FormEvent) => { event.preventDefault(); leave(name.trim()) }

  return (
    <div className={`intro${leaving ? ' intro--leaving' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* First in the Tab order, so anyone can skip the intro at once. */}
      <button type="button" className="intro__skip" onClick={() => leave('')}>Skip the intro</button>
      <OrbitGlobe />
      <div className="intro__panel">
        <h2 id={titleId} ref={heading} tabIndex={-1} className="intro__title">Welcome to the Earth Jukebox</h2>
        <p className="intro__line">{line}</p>
        {!started && <button type="button" className="intro__start" onClick={() => void start()}>Start</button>}
        <form className="intro__form" onSubmit={submit}>
          <label htmlFor={inputId}>Your name (optional)</label>
          <div className="intro__row">
            <input id={inputId} value={name} maxLength={NAME_MAX} autoComplete="given-name" onChange={event => setName(event.target.value)} />
            {hasSpeechInput() && (
              <button type="button" aria-pressed={listening} disabled={listening} onClick={listen}>{listening ? 'Listening…' : 'Say my name'}</button>
            )}
            <button type="submit" className="intro__go">Continue</button>
          </div>
          <p className="intro__hint" role="status">{hint}</p>
        </form>
      </div>
    </div>
  )
}
