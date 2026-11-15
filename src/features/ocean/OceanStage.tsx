// EIC06 T4: one ocean track on /listen. The video is the clock: the sound follows its currentTime, play, pause, seeks, rate and
// stalls, and a drift of more than 0.3 s is pulled back. Nothing sounds before a click or key press; nothing plays by itself.

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { Button, ButtonGroup, Notice, Slider, useAnnounce } from '../../components'
import { usePublishPlaying } from '../../components/jukebox/nowPlaying'
import { reducedMotion } from '../../motion'
import { CanvasGridVisualizer, ThermalScale } from './CanvasGridVisualizer'
import { cellAt, gridLookup, moveCursor, panFor, stepAt, STEPS_PER_SECOND, type Cursor } from './mapping'
import { assetUrl, type OceanTrack } from './schema'
import type { Probe } from './sound'
import { createTimerClock, type Clock } from './timerClock'
import { useOceanSound } from './useOceanSound'
import { compassFor, wordsFor } from './words'
import './ocean.css'

const RATES = [
  { value: '0.5', label: '0.5×' },
  { value: '1', label: '1×' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: '2×' },
] as const
type Rate = (typeof RATES)[number]['value']

/** How long Echo's caption stays up (and the music stays lowered). */
const CALLOUT_MS = 7000
/** The sound is pulled back to the video when they differ by more than this. */
const DRIFT_S = 0.3
const GRID_FALLBACK = { rows: 8, cols: 16 }

export function OceanStage({ track }: { track: OceanTrack }) {
  const { timeline, visual_assets: assets } = track
  const announce = useAnnounce()
  const { sound, ensure, failed } = useOceanSound(track)
  const video = useRef<HTMLVideoElement>(null)
  // A track with no video is timed by a clock that plays the part of the video's currentTime, play and pause.
  const hasVideo = Boolean(assets.video_url)
  const timer = useRef<Clock | null>(null)
  const media: RefObject<Clock | null> = hasVideo ? video : timer
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [rate, setRate] = useState<Rate>('1')
  const [loop, setLoop] = useState(false)
  const [exploring, setExploring] = useState(false)
  const [cursor, setCursor] = useState<Cursor>({ col: 8, row: 4 })
  const [caption, setCaption] = useState<string | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const lastStep = useRef(0)
  const captionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cellId = useId()
  // Read once: under reduced motion the video is not even fetched until Play, so the poster stays.
  const [still] = useState(reducedMotion)

  useEffect(() => () => clearTimeout(captionTimer.current), [])
  usePublishPlaying(playing)

  // The clock of a track with no video calls the handlers of the latest render, so they see its state.
  const live = useRef({ tick: onTimeUpdate, pause: onPause, loop })
  useEffect(() => { live.current = { tick: onTimeUpdate, pause: onPause, loop } })
  useEffect(() => {
    if (hasVideo) return
    const clock = createTimerClock({
      duration: timeline.length / STEPS_PER_SECOND,
      loop: () => live.current.loop,
      onTick: () => live.current.tick(),
      onPause: () => live.current.pause(),
    })
    timer.current = clock
    return () => { clock.dispose(); timer.current = null }
  }, [hasVideo, timeline.length])

  const words = wordsFor(track.metadata.category)
  const step = stepAt(time, timeline.length)
  const now = timeline[step]
  const grid = now.spatial_grid
  const rows = grid?.length ?? GRID_FALLBACK.rows
  const cols = grid?.[0]?.length ?? GRID_FALLBACK.cols

  function probeAt(at: Cursor, index: number): Probe {
    const cell = gridLookup(timeline[index].spatial_grid, at)
    return cell ? { sst: cell[0], pan: panFor(at.col, cols) } : 'silent'
  }

  function cellText(at: Cursor, index: number) {
    const cell = gridLookup(timeline[index].spatial_grid, at)
    const where = `Row ${at.row + 1} of ${rows}, column ${at.col + 1} of ${cols}`
    if (!cell) return `${where}: ${words.none}.`
    const { temp_min_c: lo, temp_max_c: hi } = track.calibration
    const from = cell.length > 2 ? ` from the ${compassFor(cell[2])}` : ''
    return `${where}: about ${(lo + cell[0] * (hi - lo)).toFixed(1)} °C, ${words.speed} ${Math.round(cell[1] * 100)} percent${from}.`
  }

  function endCallout() {
    clearTimeout(captionTimer.current)
    setCaption(null)
    sound.current?.duck(false)
  }

  function showCallout(index: number) {
    const { echo_callout: callout, accessibility_text: text } = timeline[index]
    if (!callout) return
    clearTimeout(captionTimer.current)
    setCaption(callout)
    announce(`${callout} ${text}`, { busy: true })
    sound.current?.duck(true)
    captionTimer.current = setTimeout(endCallout, CALLOUT_MS)
  }

  async function togglePlay() {
    const el = media.current
    if (!el) return
    if (playing) { el.pause(); return }
    const made = await ensure()
    if (!made) return
    made.play(el.currentTime, Number(rate))
    setPlaying(true)
    lastStep.current = stepAt(el.currentTime, timeline.length)
    showCallout(lastStep.current)
    try {
      await el.play()
    } catch {
      made.pause()
      setPlaying(false)
      setVideoFailed(true)
    }
  }

  function onPause() {
    if (!playing) return
    setPlaying(false)
    sound.current?.pause()
    endCallout()
    announce(`Paused. ${timeline[stepAt(media.current?.currentTime ?? 0, timeline.length)].accessibility_text}`)
  }

  function onTimeUpdate() {
    const t = media.current?.currentTime ?? 0
    setTime(t)
    const s = sound.current
    if (playing && s && Math.abs(s.mediaTime() - t) > DRIFT_S) s.seek(t)
    const next = stepAt(t, timeline.length)
    if (next === lastStep.current) return
    lastStep.current = next
    if (exploring) s?.probe(probeAt(cursor, next))
    if (playing) showCallout(next)
  }

  function scrub(index: number) {
    const el = media.current
    const target = timeline[index]
    if (el) el.currentTime = target.time_sec
    setTime(target.time_sec)
    lastStep.current = index
    sound.current?.seek(target.time_sec)
    if (exploring) sound.current?.probe(probeAt(cursor, index))
    announce(target.accessibility_text, { busy: true })
  }

  function chooseRate(next: Rate) {
    setRate(next)
    if (media.current) media.current.playbackRate = Number(next)
    sound.current?.setRate(Number(next))
    announce(`Speed ${RATES.find(r => r.value === next)?.label}`)
  }

  async function toggleExplore() {
    if (exploring) {
      setExploring(false)
      sound.current?.probe(null)
      announce('Explore off.')
      return
    }
    const made = await ensure()
    if (!made) return
    setExploring(true)
    made.probe(probeAt(cursor, step))
    announce(`Explore on. Move over the video, or focus it and use the arrow keys. ${cellText(cursor, step)}`)
  }

  function moveTo(at: Cursor, say: boolean) {
    if (at.col === cursor.col && at.row === cursor.row) return
    setCursor(at)
    sound.current?.probe(probeAt(at, step))
    if (say) announce(cellText(at, step), { busy: true })
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const at = moveCursor(cursor, event.key, rows, cols)
    if (!at) return
    event.preventDefault()
    moveTo(at, true)
  }

  function onPointer(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    moveTo(cellAt(event.clientX - box.left, event.clientY - box.top, box.width, box.height, rows, cols), false)
  }

  const metrics = now.metrics
  return (
    <section className="ocean-stage" aria-label={`${track.metadata.title}: ${assets.video_url ? 'video' : 'map'} and sound`}>
      <div className="ocean-stage__screen" style={{ aspectRatio: assets.aspect_ratio.replace(':', ' / ') }}>
        {assets.video_url ? (
          <video
            ref={video}
            className="ocean-stage__video"
            src={assetUrl(assets.video_url)}
            poster={assets.poster_url ? assetUrl(assets.poster_url) : undefined}
            muted
            playsInline
            loop={loop}
            preload={still ? 'none' : 'metadata'}
            aria-label={`${track.metadata.title}, moving map of ocean currents coloured by temperature. The text below describes it.`}
            onTimeUpdate={onTimeUpdate}
            onPause={onPause}
            onWaiting={() => sound.current?.pause()}
            onPlaying={() => { if (playing) sound.current?.play(video.current?.currentTime ?? 0, Number(rate)) }}
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <CanvasGridVisualizer
            grid={grid}
            next={timeline[step + 1]?.spatial_grid}
            mix={still ? 0 : time * STEPS_PER_SECOND - step}
            calibration={track.calibration}
            playing={playing}
            label={`${track.metadata.title}, a map of temperature from deep blue at 0 degrees to red at 32, with the flow drawn as streaks. The text below describes it.`}
          />
        )}
        {exploring && (
          <div
            className="ocean-stage__explore"
            role="application"
            tabIndex={0}
            aria-label={`Explore the ${assets.video_url ? 'ocean ' : ''}map. Use the arrow keys to move the reticle.`}
            aria-describedby={cellId}
            onKeyDown={onKey}
            onPointerMove={onPointer}
            onPointerDown={onPointer}
          >
            <span
              className="ocean-stage__reticle"
              aria-hidden="true"
              style={{ left: `${(cursor.col / cols) * 100}%`, top: `${(cursor.row / rows) * 100}%`, width: `${100 / cols}%`, height: `${100 / rows}%` }}
            />
          </div>
        )}
      </div>
      {!assets.video_url && <ThermalScale />}

      {caption && <p className="ocean-stage__caption"><strong>Echo:</strong> {caption}</p>}

      <p className="ocean-stage__now">
        <strong>{now.display_date}</strong>
        {metrics ? ` · mean ${metrics.sst_celsius_mean.toFixed(1)} °C (from ${metrics.sst_celsius_min.toFixed(1)} to ${metrics.sst_celsius_max.toFixed(1)})` : ' · no ocean reading'}
      </p>

      <div className="ocean-stage__controls">
        <Button variant="primary" size="medium" onClick={() => void togglePlay()}>{playing ? 'Pause' : 'Play'}</Button>
        <Button pressed={loop} onClick={() => { setLoop(!loop); announce(loop ? 'Loop off.' : 'Loop on.') }}>Loop</Button>
        <Button pressed={exploring} onClick={() => void toggleExplore()}>Explore</Button>
      </div>
      <Slider
        label="Date"
        value={step}
        min={0}
        max={timeline.length - 1}
        onChange={scrub}
        describe={i => timeline[i].display_date}
      />
      <ButtonGroup type="connected" legend="Speed" options={RATES} value={rate} onChange={chooseRate} />

      {exploring && <p id={cellId} className="ocean-stage__cell">{cellText(cursor, step)}</p>}
      <p className="ocean-stage__text">{now.accessibility_text}</p>

      {failed && <Notice variant="error">The sound could not start. Press Play to try again.</Notice>}
      {videoFailed && <Notice variant="error">The video could not be played. Choose another track, or reload the page.</Notice>}
    </section>
  )
}
