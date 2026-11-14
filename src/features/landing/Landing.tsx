// The landing page (entry view, #welcome): the spinning Earth with Echo on it, and Echo asking two questions: your name, then the
// sound vibe you like. Plain chat bubbles, no speech and no sound before a click. "Prefer manual setup?" swaps the chat for one form
// with the same two fields. Finishing (or skipping) remembers it and calls onDone, which opens Home.

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button, useAnnounce } from '../../components'
import type { PresetId } from '../../data'
import { readAudioPrefs } from '../../audio/prefs'
import OrbitGlobe from '../home/OrbitGlobe'
import { NAME_MAX, readIntro } from '../intro/storage'
import { CHAT_GREETING, MASCOT_NAME, soundQuestion, TUNE_CHIPS } from '../welcome/lines'
import { saveLanding, skipLanding } from './storage'
import './landing.css'

export default function Landing({ onDone }: { onDone: () => void }) {
  const announce = useAnnounce()
  const id = useId()
  const stepHeading = useRef<HTMLHeadingElement>(null)
  /** Set by the events that change the view, so focus moves then and never when the page first shows. */
  const moveFocus = useRef(false)
  const [step, setStep] = useState<'name' | 'sound'>('name')
  const [manual, setManual] = useState(false)
  const [name, setName] = useState(() => readIntro().name ?? '')
  const [style, setStyle] = useState<PresetId | null>(() => readAudioPrefs().style)

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    stepHeading.current?.focus()
  }, [step, manual])

  function go(next: 'name' | 'sound', line: string) {
    moveFocus.current = true
    setStep(next)
    announce(line)
  }

  function sendName(skip: boolean) {
    const value = skip ? '' : name.trim()
    setName(value)
    go('sound', soundQuestion(value))
  }

  function enter() {
    saveLanding(name.trim(), style)
    announce('Welcome aboard. Opening the Earth Jukebox.')
    onDone()
  }

  function skip() {
    skipLanding()
    announce('Welcome skipped.')
    onDone()
  }

  function toggleManual() {
    moveFocus.current = true
    setManual(value => !value)
  }

  const echo = (text: string) => <li className="landing__line landing__line--echo"><span className="ui-label">{MASCOT_NAME}</span><span>{text}</span></li>

  return (
    <main className="landing">
      <h1 className="landing__title">Earth Jukebox</h1>
      <OrbitGlobe />
      <section className="landing__card ui-glass" aria-labelledby={`${id}-welcome`}>
        <div className="landing__top">
          {/* First in focus order, so anyone can skip at once. */}
          <Button variant="text" onClick={skip}>Skip the welcome</Button>
          <Button variant="text" onClick={toggleManual}>{manual ? `Chat with ${MASCOT_NAME} instead` : 'Prefer manual setup?'}</Button>
        </div>
        <h2 id={`${id}-welcome`} className="landing__heading">Welcome</h2>
        {manual ? (
          <form className="landing__form" aria-label="Manual setup" onSubmit={(event: FormEvent) => { event.preventDefault(); enter() }}>
            <h3 ref={stepHeading} tabIndex={-1} className="landing__step">Manual setup</h3>
            <label className="landing__field" htmlFor={`${id}-name`}>
              Your name (optional)
              <input id={`${id}-name`} type="text" maxLength={NAME_MAX} autoComplete="off" value={name} onChange={event => setName(event.target.value)} />
            </label>
            <label className="landing__field" htmlFor={`${id}-style`}>
              Audio preference
              <select id={`${id}-style`} value={style ?? ''} onChange={event => setStyle(TUNE_CHIPS.find(chip => chip.id === event.target.value)?.id ?? null)}>
                <option value="">The data set&apos;s own sound</option>
                {TUNE_CHIPS.map(chip => <option key={chip.id} value={chip.id}>{chip.label}</option>)}
              </select>
            </label>
            <div className="landing__buttons"><Button type="submit" variant="filled" size="large">Enter Earth Jukebox</Button></div>
          </form>
        ) : (
          <>
            <ol className="landing__transcript" aria-label={`Conversation with ${MASCOT_NAME}`}>
              {echo(CHAT_GREETING)}
              {step === 'sound' && <li className="landing__line landing__line--you">{name || '(No name)'}</li>}
              {step === 'sound' && echo(soundQuestion(name))}
            </ol>
            {step === 'name' ? (
              <form className="landing__form" onSubmit={(event: FormEvent) => { event.preventDefault(); sendName(false) }}>
                <h3 ref={stepHeading} tabIndex={-1} className="landing__step">Your name</h3>
                <div className="landing__name">
                  <label className="landing__field" htmlFor={`${id}-chat-name`}>
                    What should I call you? (optional)
                    <input id={`${id}-chat-name`} type="text" maxLength={NAME_MAX} autoComplete="off" value={name} onChange={event => setName(event.target.value)} />
                  </label>
                  <Button type="submit" variant="filled">Next</Button>
                </div>
                <div className="landing__buttons"><Button variant="text" onClick={() => sendName(true)}>Skip this question</Button></div>
              </form>
            ) : (
              <div className="landing__form">
                <h3 ref={stepHeading} tabIndex={-1} className="landing__step">Your sound</h3>
                <div className="landing__buttons landing__pills" role="group" aria-label="Sound vibe">
                  {TUNE_CHIPS.map(chip => <Button key={chip.id} pressed={style === chip.id} onClick={() => setStyle(style === chip.id ? null : chip.id)}>{chip.label}</Button>)}
                </div>
                <div className="landing__buttons">
                  <Button variant="text" onClick={() => go('name', CHAT_GREETING)}>Back</Button>
                  <Button variant="filled" size="large" onClick={enter}>Enter Earth Jukebox</Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
