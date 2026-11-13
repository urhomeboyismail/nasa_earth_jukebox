// The guided tour on screen (docs/tickets/JB05-tour-flight-path.md): Echo flies along a curve to the control it is pointing at, a glowing trail
// fades behind it, and a ring frames the control. All of it is decoration and ignores the pointer. The words are in the bar's caption, which the
// app's announcer also reads. Under reduced motion Echo just appears beside the control.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button } from '../../components'
import { Echo } from '../../components/Mascot'
import { anchorFor, TOUR_ECHO_SIZE } from './flightPath'
import { backStep, FLIGHT_MS, nextStep, stopTour, useTour, type TourStop } from './tour'
import './tour.css'

type CssVars = CSSProperties & Record<`--${string}`, string>
type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number }

const measure = (selector: string): Rect | null => {
  const rect = document.querySelector(selector)?.getBoundingClientRect()
  return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null
}

/** Echo, the trail and the ring for one stop. A new stop remounts it, so the flight starts again. */
function TourStopView({ stop }: { stop: TourStop }) {
  const [rect, setRect] = useState(() => measure(stop.selector))

  // A scroll or resize moves the control: measure again, once a frame.
  useEffect(() => {
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setRect(measure(stop.selector)))
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [stop.selector])

  const flying = stop.phase === 'flying'
  const rest = rect ? anchorFor(rect, { w: window.innerWidth, h: window.innerHeight }) : { ...stop.to, side: stop.side }
  const half = TOUR_ECHO_SIZE / 2
  const echoStyle: CssVars = flying
    ? { '--tour-path': `path("${stop.path}")`, '--tour-flight': `${FLIGHT_MS}ms` }
    : { transform: `translate(${rest.x - half}px, ${rest.y - half}px)` }

  return (
    <div className="tour__stop" aria-hidden="true">
      {!stop.reduced && (
        <svg className="tour__trail" width="100%" height="100%">
          <path d={stop.path} pathLength="1" />
        </svg>
      )}
      {rect && <div className="tour__ring" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />}
      <div className="tour__echo" data-flying={flying} data-side={rest.side} style={echoStyle}>
        <Echo motion={flying ? 'boosting' : 'pointing'} thrust={flying ? 1 : 0} />
      </div>
    </div>
  )
}

/**
 * The tour's layer and bar. Rendered by the dock; the tour itself lives in tour.ts, so it carries on when the dock remounts on a page change.
 * Focus goes to Next when the tour starts (the listener just asked for it) and back to Echo when it ends. Pressing Next or Back never moves it.
 */
export function TourLayer() {
  const tour = useTour()
  const bar = useRef<HTMLElement>(null)
  const wasActive = useRef(false)

  useEffect(() => {
    if (tour.active && !wasActive.current) bar.current?.querySelector<HTMLElement>('[data-tour-next]')?.focus()
    if (!tour.active && wasActive.current && (!document.activeElement || document.activeElement === document.body)) {
      document.querySelector<HTMLElement>('.mascot-dock__button')?.focus()
    }
    wasActive.current = tour.active
  }, [tour.active])

  // Esc stops the tour wherever focus is.
  useEffect(() => {
    if (!tour.active) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) stopTour() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour.active])

  if (!tour.active) return null
  const last = tour.index >= tour.total - 1
  return (
    <>
      {tour.stop && <TourStopView key={tour.stop.key} stop={tour.stop} />}
      <section ref={bar} className="tour-bar" aria-label="Guided tour">
        <p className="tour-bar__step">Step {tour.index + 1} of {tour.total}</p>
        <p className="tour-bar__caption">{tour.caption}</p>
        <div className="tour-bar__actions">
          <Button disabled={tour.index === 0} onClick={backStep}>Back</Button>
          <Button data-tour-next="" variant="primary" onClick={nextStep}>{last ? 'Finish' : 'Next'}</Button>
          <Button variant="text" onClick={stopTour}>Stop tour</Button>
        </div>
      </section>
    </>
  )
}
