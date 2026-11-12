// Scroll-driven air boosters (docs/tickets/JB02-scroll-boosters.md): how fast the page is scrolling, as the motion Echo's boots should show.
// A passive scroll listener and one requestAnimationFrame per frame. Nothing moves under prefers-reduced-motion, and no listener is added.

import { useEffect, useState } from 'react'

/** px per ms: above this, boosting. */
export const BOOST_START = 0.4
/** px per ms: thrust 1. */
export const BOOST_FULL = 3
/** px per ms: a stop from at least this speed gives a retro-burn. */
export const RETRO_FROM = 1.5
export const RETRO_MS = 400
/** No scroll event for this long means scrolling has stopped. */
const STOP_MS = 120
/** The length of one frame, used as the time the first sample of a scroll covers. */
const FRAME_MS = 16

export type ScrollMotion = { motion: 'idle' | 'boosting' | 'retro'; thrust: number }

const IDLE: ScrollMotion = { motion: 'idle', thrust: 0 }
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

/** 0 below BOOST_START, 1 at BOOST_FULL and above, linear between. */
export function thrustFor(speed: number): number {
  if (!(speed > BOOST_START)) return 0
  return Math.min(1, (speed - BOOST_START) / (BOOST_FULL - BOOST_START))
}

function reducedMotionQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_QUERY) : null
}

export function useScrollVelocity(): ScrollMotion {
  const [reduced, setReduced] = useState(() => reducedMotionQuery()?.matches ?? false)
  const [state, setState] = useState<ScrollMotion>(IDLE)

  useEffect(() => {
    const query = reducedMotionQuery()
    if (!query) return
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reduced) return
    const change = (next: ScrollMotion) => setState(current => (current.motion === next.motion && current.thrust === next.thrust ? current : next))

    let lastY = window.scrollY
    let prevY = lastY
    let prevT = 0
    let curY = lastY
    let curT = 0
    let top = 0
    let frame = 0
    let stopTimer: ReturnType<typeof setTimeout> | undefined
    let retroTimer: ReturnType<typeof setTimeout> | undefined

    const tick = () => {
      frame = 0
      const dt = curT - prevT
      if (dt <= 0) return
      const speed = Math.abs(curY - prevY) / dt
      prevY = curY
      prevT = curT
      top = Math.max(top, speed)
      change(speed > BOOST_START ? { motion: 'boosting', thrust: thrustFor(speed) } : IDLE)
    }

    const onStop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      stopTimer = undefined
      lastY = curY
      const fast = top >= RETRO_FROM
      top = 0
      if (!fast) return change(IDLE)
      change({ motion: 'retro', thrust: 1 })
      retroTimer = setTimeout(() => change(IDLE), RETRO_MS)
    }

    const onScroll = () => {
      const now = performance.now()
      if (stopTimer === undefined) {
        // A new scroll starts: its first sample covers one frame, from where the page last rested.
        clearTimeout(retroTimer)
        prevY = lastY
        prevT = now - FRAME_MS
      }
      curY = window.scrollY
      curT = now
      if (!frame) frame = requestAnimationFrame(tick)
      clearTimeout(stopTimer)
      stopTimer = setTimeout(onStop, STOP_MS)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
      clearTimeout(stopTimer)
      clearTimeout(retroTimer)
    }
  }, [reduced])

  return reduced ? IDLE : state
}
