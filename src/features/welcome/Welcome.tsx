// The welcome (F37 T1): the mascot greets a first-time visitor on Home, asks how they want to use the app, runs a sound check
// and sets sensible defaults. Inline, not a modal. Nothing sounds or speaks before a click, and the screen reader path never
// uses speech: the screen reader is that listener's voice.

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { subscribeContext } from '../../assistant/context'
import { saveAudioPrefs } from '../../audio/prefs'
import { useSoundEngine } from '../../audio/useSoundEngine'
import { Button, Slider, useAnnounce } from '../../components'
import { RobotBadge } from '../../components/RobotBadge'
import { playerUpdate, type PresetId, type Visualization } from '../../data'
import { useDescriptionDetail } from '../../describe/detail'
import { currentDataParam, hashFor } from '../../route'
import { NAME_MAX, readIntro, saveIntro, useIntro } from '../intro/storage'
import { useMascotGuide } from '../mascot/useMascotGuide'
import { startTour } from '../mascot/tour'
import { resetOnboarding } from '../onboarding/store'
import { sendPlayerCommand } from '../player/controls'
import { SoundPrefs } from '../player/SoundPrefs'
import { CHAT_GREETING, CHECK_STEPS, GREETING, lockedLine, MASCOT_NAME, NOT_HEARD, PATH_HINTS, PATH_LABELS, TUNE_CHIPS, tuneQuestion, VOLUME_QUESTION } from './lines'
import { ManualSetup } from './ManualSetup'
import { hush, speak } from './speak'
import { saveWelcome, type WelcomePath } from './storage'
import './welcome.css'

const PATHS: WelcomePath[] = ['screen-reader', 'map', 'play']
const DEFAULT_VOLUME = 80

/** Sends "play" until the player says it is playing: the page loads and its sounds are prepared after it opens. */
function playWhenReady() {
  const finish = () => { unsubscribe(); window.clearInterval(retry); window.clearTimeout(limit) }
  const unsubscribe = subscribeContext(update => {
    if (update.key !== 'player') return
    const player = playerUpdate.safeParse(update.data)
    if (player.success && player.data.playing) finish()
  })
  const retry = window.setInterval(() => sendPlayerCommand('play'), 600)
  const limit = window.setTimeout(finish, 10_000)
}

/** Puts focus on the page's heading, where a screen reader announces it. */
const focusHeading = () => document.querySelector<HTMLElement>('main h1')?.focus()

export default function Welcome({ visualization }: { visualization: Visualization | null }) {
  const announce = useAnnounce()
  const [, setDetail] = useDescriptionDetail()
  const guide = useMascotGuide()
  const intro = useIntro()
  const [path, setPath] = useState<WelcomePath | null>(null)
  /** The chat asks the name, then the sound, then the path. A name the planet intro already has is not asked again. */
  const [phase, setPhase] = useState<'name' | 'tune' | 'path'>(intro.name ? 'tune' : 'name')
  const [manual, setManual] = useState(false)
  const [name, setName] = useState(intro.name ?? '')
  const [style, setStyle] = useState<PresetId | null>(null)
  /** The path chosen in the chat or the form, shared so that switching views keeps it. */
  const [pick, setPick] = useState<WelcomePath>('map')
  const stepHeading = useRef<HTMLHeadingElement>(null)
  /** Set by the events that change the step, so focus moves then and never when the welcome first shows. */
  const moveFocus = useRef(false)
  const [step, setStep] = useState(0)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [missed, setMissed] = useState(false)
  const [heard, setHeard] = useState(false)
  /** True while a sound check is running (its spoken line, then its note), so a second one cannot start over it. */
  const [checking, setChecking] = useState(false)
  /** Bumped when the check is left, so a note that was waiting for the speech to end is not played afterwards. */
  const checkRun = useRef(0)
  const titleId = useId()
  const checkHeading = useRef<HTMLHeadingElement>(null)

  const { engine } = useSoundEngine(visualization?.mapping)
  useEffect(() => () => { checkRun.current += 1; engine?.stop(); hush() }, [engine])

  // The sound check opens with focus on its heading, so a keyboard or screen reader user lands on it.
  useEffect(() => { if (path) checkHeading.current?.focus() }, [path])
  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    stepHeading.current?.focus()
  }, [phase, manual])

  const talking = path === 'map'
  const say = (text: string) => {
    announce(text)
    if (talking) speak(text)
  }

  /** One plain note from a side (the middle category, as "Test sound" plays). Needs the click it is called from. */
  async function playNote(pan: number, level = volume) {
    if (!engine || !visualization) return
    await engine.unlock()
    engine.setVolume(level / 100)
    engine.setStyle('simple')
    engine.stop()
    const { categories } = visualization.mapping
    engine.playSequence([{ category: categories[Math.floor(categories.length / 2)].id, atMs: 0, pan }], () => {})
  }

  /**
   * One sound-check question: the spoken line first (when speech is on), then the note, so the two never overlap. The audio is unlocked
   * here, in the click, before the wait.
   */
  async function playQuestion(pan: number, question: string) {
    const run = ++checkRun.current
    setHeard(true)
    setChecking(true)
    try {
      void engine?.unlock()
      if (talking) await speak(question)
      if (run === checkRun.current) await playNote(pan)
    } finally {
      if (run === checkRun.current) setChecking(false)
    }
  }

  async function playVolumeNote() {
    const run = ++checkRun.current
    setChecking(true)
    try {
      await playNote(0)
    } finally {
      if (run === checkRun.current) setChecking(false)
    }
  }

  function skipWelcome() {
    saveWelcome({ done: true })
    announce('Welcome skipped.')
    window.setTimeout(focusHeading, 0)
  }

  function saveName(value: string) {
    if (value) saveIntro({ ...readIntro(), name: value })
  }

  function sendName(skip: boolean) {
    const value = skip ? '' : name.trim()
    setName(value)
    saveName(value)
    moveFocus.current = true
    setPhase('tune')
    announce(tuneQuestion(value))
  }

  function pickStyle(next: PresetId | null) {
    setStyle(next)
    saveAudioPrefs({ style: next })
    moveFocus.current = true
    setPhase('path')
    announce(GREETING)
  }

  function toggleManual() {
    moveFocus.current = true
    setManual(value => !value)
  }

  function saveManual() {
    const value = name.trim()
    saveName(value)
    saveAudioPrefs({ style })
    finish(undefined, pick)
  }

  function choose(next: WelcomePath) {
    setPath(next)
    setPick(next)
    setStep(0)
    setMissed(false)
    setHeard(false)
    const line = `${PATH_LABELS[next]}. Let's check your sound. ${CHECK_STEPS[0].text}`
    announce(line)
    // The path is only in state after this render, so say whether to speak from the choice itself.
    if (next === 'map') speak(line)
  }

  /** Applies the path's defaults, remembers that the welcome is done and goes to the page the path leads to. */
  function finish(volumeToKeep?: number, chosen: WelcomePath | null = path) {
    if (!chosen) return
    checkRun.current += 1
    hush()
    engine?.stop()
    setDetail(chosen === 'screen-reader' ? 'concise' : 'rich')
    saveWelcome({ done: true, path: chosen, speech: chosen === 'map', ...(volumeToKeep !== undefined && { volume: volumeToKeep / 100 }) })
    const page = chosen === 'screen-reader' ? 'learn' : 'listen'
    window.location.hash = hashFor(page, { data: currentDataParam() })
    // Echo says it from the dock; the line is announced now, so a screen reader hears it too.
    const locked = lockedLine(name.trim())
    guide.offerTip({ text: locked })
    announce(locked)
    if (chosen === 'play') { resetOnboarding(); playWhenReady() }
    // The map path is the sighted one: show it around. The other paths already have sound or a screen reader talking.
    if (chosen === 'map') startTour(announce)
  }

  function answerYes() {
    setMissed(false)
    setHeard(false)
    const next = step + 1
    setStep(next)
    if (next < CHECK_STEPS.length) say(CHECK_STEPS[next].text)
    else say(`${VOLUME_QUESTION} Move the slider, press Play, and say yes when it is comfortable.`)
  }

  function answerNo() {
    setMissed(true)
    announce(NOT_HEARD)
  }

  const current = step < CHECK_STEPS.length ? CHECK_STEPS[step] : null

  return (
    <section className="welcome ui-glass" aria-labelledby={titleId}>
      <div className="welcome__top">
        {/* First in focus order, so anyone can skip the welcome at once. */}
        <Button variant="text" onClick={skipWelcome}>Skip the welcome</Button>
        {!path && <Button variant="text" onClick={toggleManual}>{manual ? 'Chat with Echo instead' : 'Prefer manual setup?'}</Button>}
      </div>
      <div className="welcome__body">
        <RobotBadge size={128} className="welcome__mascot" />
        <div className="welcome__talk">
          <h2 id={titleId} className="welcome__title">Welcome</h2>
          {!path && manual ? (
            <>
              <h3 ref={stepHeading} tabIndex={-1} className="welcome__step-title">Manual setup</h3>
              <div className="welcome__card ui-glass">
                <ManualSetup name={name} onName={setName} style={style} onStyle={setStyle} path={pick} onPath={setPick} onSave={saveManual} />
              </div>
            </>
          ) : !path ? (
            <>
              <ol className="welcome__transcript" aria-label="Conversation with Echo">
                <li className="welcome__line--echo"><span className="ui-label">{MASCOT_NAME}</span><span>{CHAT_GREETING}</span></li>
                {phase !== 'name' && <li className="welcome__line--you">{name || '(No name)'}</li>}
                {phase !== 'name' && <li className="welcome__line--echo"><span className="ui-label">{MASCOT_NAME}</span><span>{tuneQuestion(name)}</span></li>}
                {phase === 'path' && <li className="welcome__line--you">{TUNE_CHIPS.find(chip => chip.id === style)?.label ?? '(No preference)'}</li>}
                {phase === 'path' && <li className="welcome__line--echo"><span className="ui-label">{MASCOT_NAME}</span><span>{GREETING}</span></li>}
              </ol>
              {phase === 'name' && (
                <form className="welcome__chat" onSubmit={(event: FormEvent) => { event.preventDefault(); sendName(false) }}>
                  <h3 ref={stepHeading} tabIndex={-1} className="welcome__step-title">Your name</h3>
                  <div className="welcome__name">
                    <label className="welcome__field">
                      What should I call you? (optional)
                      <input type="text" maxLength={NAME_MAX} autoComplete="off" value={name} onChange={event => setName(event.target.value)} />
                    </label>
                    <Button type="submit" variant="filled">Send</Button>
                  </div>
                  <div className="welcome__buttons"><Button variant="text" onClick={() => sendName(true)}>Skip this question</Button></div>
                </form>
              )}
              {phase === 'tune' && (
                <div className="welcome__chat">
                  <h3 ref={stepHeading} tabIndex={-1} className="welcome__step-title">Your sound</h3>
                  <div className="welcome__buttons welcome__pills" role="group" aria-label="Sound style">
                    {TUNE_CHIPS.map(chip => <Button key={chip.id} pressed={style === chip.id} onClick={() => pickStyle(chip.id)}>{chip.label}</Button>)}
                  </div>
                  <div className="welcome__buttons"><Button variant="text" onClick={() => pickStyle(null)}>Skip this question</Button></div>
                </div>
              )}
              {phase === 'path' && (
              <>
              <h3 ref={stepHeading} tabIndex={-1} className="welcome__step-title">How you will use it</h3>
              <ul className="welcome__paths" aria-label="Ways to use the app">
                {PATHS.map(option => {
                  const hint = `${titleId}-${option}`
                  return (
                    <li key={option}>
                      <Button size="large" variant={option === 'play' ? 'filled' : 'tonal'} aria-describedby={hint} onClick={() => choose(option)}>
                        {PATH_LABELS[option]}
                      </Button>
                      <p id={hint} className="welcome__hint">{PATH_HINTS[option]}</p>
                    </li>
                  )
                })}
              </ul>
              </>
              )}
            </>
          ) : (
            <div className="welcome__check">
              <h3 ref={checkHeading} tabIndex={-1} className="welcome__step-title">Sound check</h3>
              {!engine && <p role="status">The sounds are still loading. You can skip the sound check.</p>}
              {current ? (
                <>
                  <p>{current.text} Press Play, then answer.</p>
                  <div className="welcome__buttons">
                    <Button disabled={!engine || checking} onClick={() => void playQuestion(current.pan, current.question)}>
                      {heard ? 'Replay' : 'Play'}
                    </Button>
                  </div>
                  <p className="welcome__question" id={`${titleId}-q`}>{current.question}</p>
                  <div className="welcome__buttons" role="group" aria-labelledby={`${titleId}-q`}>
                    <Button disabled={!heard} onClick={answerYes}>Yes</Button>
                    <Button disabled={!heard} onClick={answerNo}>No</Button>
                  </div>
                  {missed && <p className="welcome__hint">{NOT_HEARD}</p>}
                </>
              ) : (
                <>
                  <h4 className="welcome__step-title">What do you love listening to?</h4>
                  <SoundPrefs ownPreset={visualization?.sonification?.preset ?? 'major'} instruments sample />
                  <p id={`${titleId}-q`} className="welcome__question">{VOLUME_QUESTION}</p>
                  <Slider label="Volume" min={0} max={100} step={5} value={volume} onChange={setVolume} describe={value => `${value} percent`} />
                  <div className="welcome__buttons" role="group" aria-labelledby={`${titleId}-q`}>
                    <Button disabled={!engine || checking} onClick={() => void playVolumeNote()}>Play</Button>
                    <Button variant="filled" onClick={() => finish(volume)}>Yes, this is comfortable</Button>
                  </div>
                </>
              )}
              <div className="welcome__buttons">
                <Button variant="text" onClick={() => finish()}>Skip the sound check</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
