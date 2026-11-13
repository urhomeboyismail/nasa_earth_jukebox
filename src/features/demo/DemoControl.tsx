import { useEffect, useRef, useState } from 'react'
import { subscribeContext } from '../../assistant/context'
import { Button } from '../../components'
import { Sonny } from '../../components/Mascot'
import { playerUpdate } from '../../data'
import { currentDataParam, hashFor } from '../../route'
import { hush, speak } from '../welcome/speak'
import { readWelcome } from '../welcome/storage'
import { useMascotOn } from '../help/mascotSetting'
import { sendPlayerCommand } from '../player/controls'
import { onPredictDone, requestPredict } from '../predict/bus'
import { runDemo, type DemoDeps } from './runDemo'
import { DEMO_STEPS } from './script'
import './demo.css'

/** Longest the demo waits for the dates to finish, so a sound that never starts cannot hold the tour. */
const PLAY_TIMEOUT_MS = 60_000
/** Longest the demo waits for a question to be answered, so a listener who walks away cannot hold the tour. */
const PREDICT_TIMEOUT_MS = 45_000
/** Longest the demo waits for a player to take the request. */
const PREDICT_START_MS = 5_000
/** The page loads on first visit and the sounds are prepared after it opens, so "play" is sent again until it takes. */
const RETRY_MS = 600
/** Longest the demo waits for one caption to be spoken, so a voice that never ends cannot hold the tour. */
const SPEAK_TIMEOUT_MS = 15_000

/** Pauses the music, then speaks the caption. Resolves when the speech ends, after 15 seconds, or at once where there is no speech. */
const speakCaption = (text: string): Promise<void> => {
  sendPlayerCommand('pause')
  return new Promise(resolve => {
    const timer = window.setTimeout(resolve, SPEAK_TIMEOUT_MS)
    void speak(text).then(() => { window.clearTimeout(timer); resolve() })
  })
}

const sleep: DemoDeps['sleep'] = (ms, signal) =>
  new Promise(resolve => {
    if (signal.aborted) return resolve()
    const done = () => { window.clearTimeout(timer); signal.removeEventListener('abort', done); resolve() }
    const timer = window.setTimeout(done, ms)
    signal.addEventListener('abort', done)
  })

/** Sends "play" until the player says it is playing, then waits for it to say it has finished. */
const playAndWait: DemoDeps['playAndWait'] = (signal) =>
  new Promise(resolve => {
    let playing = false
    const finish = () => { unsubscribe(); window.clearInterval(retry); window.clearTimeout(limit); signal.removeEventListener('abort', finish); resolve() }
    const unsubscribe = subscribeContext(update => {
      if (update.key !== 'player') return
      const player = playerUpdate.safeParse(update.data)
      if (player.success && player.data.playing) playing = true
      if (update.announce?.startsWith('playback_finished')) finish()
    })
    const retry = window.setInterval(() => { if (!playing) sendPlayerCommand('play') }, RETRY_MS)
    const limit = window.setTimeout(finish, PLAY_TIMEOUT_MS)
    signal.addEventListener('abort', finish)
    if (signal.aborted) finish()
  })

/** Asks the player for one question and waits until it is answered or stopped, or until it times out. The page loads on first visit, so the request is sent again until a player takes it. */
const predictAndWait: DemoDeps['predictAndWait'] = (signal) =>
  new Promise(resolve => {
    const finish = () => { unsubscribe(); window.clearInterval(retry); window.clearTimeout(limit); window.clearTimeout(giveUp); signal.removeEventListener('abort', finish); resolve() }
    const unsubscribe = onPredictDone(finish)
    const limit = window.setTimeout(finish, PREDICT_TIMEOUT_MS)
    // With no player to ask, the step ends rather than holding the tour.
    const giveUp = window.setTimeout(finish, PREDICT_START_MS)
    const ask = () => { if (requestPredict()) { window.clearInterval(retry); window.clearTimeout(giveUp) } }
    const retry = window.setInterval(ask, RETRY_MS)
    signal.addEventListener('abort', finish)
    if (signal.aborted) finish()
    else ask()
  })

/** A button that plays a scripted tour of the app, with a caption that says what it is doing. Escape or the same button stops it. */
export function DemoControl() {
  const [running, setRunning] = useState(false)
  const [caption, setCaption] = useState('')
  // For this visit only; not saved. Off by default, and not offered on the screen reader path (a screen reader is that listener's voice).
  const [aloud, setAloud] = useState(false)
  const [screenReader] = useState(() => readWelcome().path === 'screen-reader')
  const abort = useRef<AbortController | null>(null)
  const mascotOn = useMascotOn()

  function stop() {
    abort.current?.abort()
    hush()
    sendPlayerCommand('stop')
  }

  async function start() {
    const controller = new AbortController()
    abort.current = controller
    setRunning(true)
    const finished = await runDemo(DEMO_STEPS, {
      goTo: page => { window.location.hash = hashFor(page, { data: currentDataParam() }) },
      say: setCaption,
      playAndWait,
      predictAndWait,
      sleep,
      speakCaption: aloud && !screenReader ? speakCaption : undefined,
    }, controller.signal)
    if (abort.current === controller) abort.current = null
    setRunning(false)
    setCaption(finished ? 'The demo has finished.' : 'The demo was stopped.')
  }

  useEffect(() => {
    if (!running) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) stop() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running])

  useEffect(() => () => abort.current?.abort(), [])

  return (
    <div className="demo">
      <Button pressed={running} onClick={running ? stop : () => void start()}>{running ? 'Stop the demo' : 'Play the demo'}</Button>
      {!screenReader && (
        <label className="demo__aloud">
          <input type="checkbox" checked={aloud} disabled={running} onChange={event => setAloud(event.target.checked)} />
          Read the demo aloud
        </label>
      )}
      {/* The mascot's face sits beside what it says. It is decoration: the caption is the text. */}
      <div className="demo__say">
        {mascotOn && caption && <Sonny size={32} className="demo__mascot" />}
        <p className="demo__caption" aria-live="polite">{caption}</p>
      </div>
    </div>
  )
}
