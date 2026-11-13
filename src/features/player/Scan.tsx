// Scan (docs/PLAN.md §6.3, ticket SN08): one checked frame swept from west to east in about five seconds, each column a short chord, so the shape of
// a frame can be heard. The plan (what sounds when) is src/sonify/scan.ts; the ensemble (SN04) plays it; this panel starts it from a click, draws the
// thin line that shows where the sweep is, and says in words when it starts and ends. Nothing sounds before the click (WCAG 1.4.2).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { SCHEDULE_LOOKAHEAD_S } from '../../audio/ensemble/constants'
import { useEnsemble } from '../../audio/ensemble/useEnsemble'
import { Button, Slider, useAnnounce } from '../../components'
import { dateFormatterFor } from '../../dates'
import { primaryRegion, type Visualization } from '../../data'
import { presetFor } from '../../sonify'
import { columnAt, scanPlan, SCAN_MS_PER_COLUMN, type ScanColumn } from '../../sonify/scan'
import { scanFeatures } from './scanFeatures'
import { Viewer } from './Viewer'
import './symphony.css'

type Phase = 'idle' | 'reading' | 'scanning'
/** Where the line is: the column the sweep has reached, and how far across the scanned area it is (0 to 1). */
type Line = { column: number; fraction: number }

const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const START = 'Scanning from the west edge. About five seconds.'

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Scan({ visualization }: { visualization: Visualization }) {
  const announce = useAnnounce()
  const { frames, source } = visualization
  const preset = presetFor(visualization.sonification?.preset ?? 'major')
  const { ensemble, status } = useEnsemble(preset, 'full')
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [line, setLine] = useState<Line | null>(null)
  const [message, setMessage] = useState('')
  const format = dateFormatterFor(frames.map(frame => frame.date))
  const frame = frames[index]
  const area = visualization.mapArea ?? WHOLE

  /** Bumped by every start and stop, so a reading that finishes after a Stop is ignored. */
  const token = useRef(0)
  const active = useRef(false)
  const raf = useRef<number | null>(null)

  const cancelLoop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
  }, [])

  const finish = useCallback((spoken: string) => {
    active.current = false
    token.current++
    cancelLoop()
    setPhase('idle')
    setLine(null)
    announce(spoken)
  }, [announce, cancelLoop])

  /** Stop scan, Escape, a mode change, or the browser taking the sound away. */
  const stop = useCallback(() => {
    if (!active.current) return
    ensemble.stop()
    finish('Scan stopped.')
  }, [ensemble, finish])

  /** Draws the line from the audio clock until the last column. */
  const follow = useCallback((plan: ScanColumn[], startsAt: number) => {
    const reduced = prefersReducedMotion()
    const total = plan.length * SCAN_MS_PER_COLUMN
    const tick = () => {
      const elapsedMs = (ensemble.now() - startsAt) * 1000
      if (elapsedMs >= total) {
        finish('Scan finished.')
        return
      }
      const column = columnAt(Math.max(0, elapsedMs), plan.length) ?? plan.length - 1
      // Sliding by default; with reduced motion the line jumps from column to column.
      const fraction = reduced ? column / plan.length : Math.max(0, elapsedMs) / total
      setLine(before => (before && before.column === column && before.fraction === fraction ? before : { column, fraction }))
      raf.current = requestAnimationFrame(tick)
    }
    tick()
  }, [ensemble, finish])

  async function begin() {
    if (active.current) return
    active.current = true
    const mine = ++token.current
    setMessage('')
    setPhase('reading')
    // The click is what starts the audio, so this is called before anything is waited for.
    const started = ensemble.start()
    try {
      const [features] = await Promise.all([scanFeatures(visualization, frame), started])
      if (mine !== token.current) return
      if (ensemble.status() !== 'on') {
        active.current = false
        setPhase('idle')
        setMessage('The browser has turned the sound off. Press Scan from the west edge again.')
        return
      }
      const plan = scanPlan(features, preset)
      if (plan.every(column => column.dropout)) {
        // Nothing to hear: one cue instead of sixty-four, and the words say so.
        ensemble.playDropout()
        active.current = false
        setPhase('idle')
        setMessage('Not enough data to scan this date.')
        announce('Not enough data to scan this date.')
        return
      }
      const startsAt = ensemble.now() + SCHEDULE_LOOKAHEAD_S
      for (const column of plan) {
        const at = startsAt + column.atMs / 1000
        if (column.dropout) ensemble.playDropout(at)
        else ensemble.playNotes(column.notes, at)
      }
      setPhase('scanning')
      announce(START)
      follow(plan, startsAt)
    } catch (error) {
      if (mine !== token.current) return
      active.current = false
      setPhase('idle')
      setMessage(`The picture could not be read. ${error instanceof Error ? error.message : String(error)}`.trim())
    }
  }

  // The page hiding, or the browser taking the sound away, ends the scan.
  useEffect(() => {
    if (phase === 'scanning' && status !== 'on') stop()
  }, [phase, status, stop])

  // Leaving Scan lets go of the loop; the ensemble is let go of by its own hook.
  useEffect(() => () => {
    token.current++
    active.current = false
    cancelLoop()
  }, [cancelLoop])

  // Escape stops the scan wherever focus is: a button that has just been pressed is disabled, so focus is not always inside the panel.
  useEffect(() => {
    if (phase === 'idle') return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        stop()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, stop])

  // The button that was pressed is disabled while the scan runs, so focus moves to Stop scan and comes back to Scan afterwards (never lost to the page).
  const controls = useRef<HTMLDivElement>(null)
  const wasBusy = useRef(false)
  useEffect(() => {
    const [scanButton, stopButton] = Array.from(controls.current?.querySelectorAll('button') ?? [])
    const here = document.activeElement
    const mine = here === document.body || here === null || controls.current?.contains(here)
    if (phase !== 'idle') stopButton?.focus()
    else if (wasBusy.current && mine) scanButton?.focus()
    wasBusy.current = phase !== 'idle'
  }, [phase])

  const busy = phase !== 'idle'
  const lineStyle: CSSProperties | undefined = line
    ? { position: 'absolute', top: 0, bottom: 0, left: `${(area.x0 + line.fraction * (area.x1 - area.x0)) * 100}%`, width: '3px', background: '#fff', outline: '1px solid rgba(0, 0, 0, 0.8)', pointerEvents: 'none' }
    : undefined

  return (
    <section className="player symphony" aria-label="Scan">
      <Viewer frame={frame} dateText={format(frame.date)} region={primaryRegion(visualization)} source={source}>
        {/* Only for sighted listeners; the start and the end are announced in words. */}
        {line && <div className="scan__line" data-column={line.column} aria-hidden="true" style={lineStyle} />}
      </Viewer>

      <p className="symphony__status">
        {message || (phase === 'reading' ? 'Reading the picture.' : phase === 'scanning' ? 'Scanning from west to east.' : 'Press Scan from the west edge to hear this date as a sweep.')}
      </p>

      <div className="player__controls" role="group" aria-label="Scan" ref={controls}>
        <Button variant="primary" disabled={busy} onClick={() => void begin()}>Scan from the west edge</Button>
        <Button disabled={!busy} onClick={stop}>Stop scan</Button>
      </div>

      {frames.length > 1 && (
        <div className="player__slider">
          <Slider
            label="Date"
            min={0}
            max={frames.length - 1}
            value={index}
            disabled={busy}
            onChange={setIndex}
            describe={i => format(frames[i].date)}
          />
        </div>
      )}

      <p className="player__hint">
        Each column of the map plays as a chord, high notes in the north and low notes in the south. Louder and brighter means a higher value. Escape stops.
      </p>
    </section>
  )
}
