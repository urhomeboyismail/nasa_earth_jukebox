import { useEffect, useRef, useState } from 'react'
import { subscribeContext } from '../../assistant/context'
import { Button } from '../../components'
import { Sonny } from '../../components/Mascot'
import { currentDataParam, hashFor } from '../../route'
import { useMascotOn } from '../help/mascotSetting'
import { sendPlayerCommand } from '../player/controls'
import { runDemo, type DemoDeps } from './runDemo'
import { DEMO_STEPS } from './script'
import './demo.css'

/** Longest the demo waits for the dates to finish, so a sound that never starts cannot hold the tour. */
const PLAY_TIMEOUT_MS = 60_000
/** The page loads on first visit and the sounds are prepared after it opens, so "play" is sent again until it takes. */
const RETRY_MS = 600

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
      if ((update.data as { playing?: boolean } | null)?.playing) playing = true
      if (update.announce?.startsWith('playback_finished')) finish()
    })
    const retry = window.setInterval(() => { if (!playing) sendPlayerCommand('play') }, RETRY_MS)
    const limit = window.setTimeout(finish, PLAY_TIMEOUT_MS)
    signal.addEventListener('abort', finish)
    if (signal.aborted) finish()
  })

/** A button that plays a scripted tour of the app, with a caption that says what it is doing. Escape or the same button stops it. */
export function DemoControl() {
  const [running, setRunning] = useState(false)
  const [caption, setCaption] = useState('')
  const abort = useRef<AbortController | null>(null)
  const mascotOn = useMascotOn()

  function stop() {
    abort.current?.abort()
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
      sleep,
    }, controller.signal)
    if (abort.current === controller) abort.current = null
    setRunning(false)
    setCaption(finished ? 'The demo has finished.' : 'The demo was stopped.')
  }

  useEffect(() => {
    if (!running) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') stop() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running])

  useEffect(() => () => abort.current?.abort(), [])

  return (
    <div className="demo">
      <Button pressed={running} onClick={running ? stop : () => void start()}>{running ? 'Stop the demo' : 'Play the demo'}</Button>
      {/* The mascot's face sits beside what it says. It is decoration: the caption is the text. */}
      <div className="demo__say">
        {mascotOn && caption && <Sonny size={32} className="demo__mascot" />}
        <p className="demo__caption" aria-live="polite">{caption}</p>
      </div>
    </div>
  )
}
