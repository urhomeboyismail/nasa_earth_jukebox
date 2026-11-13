// The welcome (F37 T1): the mascot greets a first-time visitor on Home, asks how they want to use the app, runs a sound check
// and sets sensible defaults. Inline, not a modal. Nothing sounds or speaks before a click, and the screen reader path never
// uses speech: the screen reader is that listener's voice.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { subscribeContext } from '../../assistant/context'
import { createSoundEngine, type SoundEngine } from '../../audio'
import { Button, Slider, useAnnounce } from '../../components'
import { RobotBadge } from '../../components/RobotBadge'
import { playerUpdate, type Visualization } from '../../data'
import { useDescriptionDetail } from '../../describe/detail'
import { currentDataParam, hashFor } from '../../route'
import { resetOnboarding } from '../onboarding/store'
import { sendPlayerCommand } from '../player/controls'
import { CHECK_STEPS, GREETING, NOT_HEARD, PATH_HINTS, PATH_LABELS, VOLUME_QUESTION } from './lines'
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
  const [path, setPath] = useState<WelcomePath | null>(null)
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

  const engine = useMemo((): SoundEngine | null => {
    if (!visualization) return null
    try {
      return createSoundEngine(visualization.mapping)
    } catch {
      return null
    }
  }, [visualization])
  useEffect(() => () => { checkRun.current += 1; engine?.stop(); hush() }, [engine])

  // The sound check opens with focus on its heading, so a keyboard or screen reader user lands on it.
  useEffect(() => { if (path) checkHeading.current?.focus() }, [path])

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

  function choose(next: WelcomePath) {
    setPath(next)
    setStep(0)
    setMissed(false)
    setHeard(false)
    const line = `${PATH_LABELS[next]}. Let's check your sound. ${CHECK_STEPS[0].text}`
    announce(line)
    // The path is only in state after this render, so say whether to speak from the choice itself.
    if (next === 'map') speak(line)
  }

  /** Applies the path's defaults, remembers that the welcome is done and goes to the page the path leads to. */
  function finish(volumeToKeep?: number) {
    if (!path) return
    checkRun.current += 1
    hush()
    engine?.stop()
    setDetail(path === 'screen-reader' ? 'concise' : 'rich')
    saveWelcome({ done: true, path, speech: path === 'map', ...(volumeToKeep !== undefined && { volume: volumeToKeep / 100 }) })
    const page = path === 'screen-reader' ? 'learn' : 'listen'
    window.location.hash = hashFor(page, { data: currentDataParam() })
    if (path === 'play') { resetOnboarding(); playWhenReady() }
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
    <section className="welcome" aria-labelledby={titleId}>
      <div className="welcome__top">
        {/* First in focus order, so anyone can skip the welcome at once. */}
        <Button variant="text" onClick={skipWelcome}>Skip the welcome</Button>
      </div>
      <div className="welcome__body">
        <RobotBadge size={128} className="welcome__mascot" />
        <div className="welcome__talk">
          <h2 id={titleId} className="welcome__title">Welcome</h2>
          {!path ? (
            <>
              <p>{GREETING}</p>
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
