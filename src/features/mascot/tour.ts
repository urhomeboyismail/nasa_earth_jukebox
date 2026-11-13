// The guided tour's state and runner (docs/tickets/JB05-tour-flight-path.md). It lives outside React because the dock is keyed by page and
// remounts when the tour changes page, so a component could not keep it. It reuses runDemo (src/features/demo/runDemo.ts): a step ends
// only when the listener presses Next, Back runs the same steps again from the one before, and Stop aborts. Nothing here takes focus.

import { useSyncExternalStore } from 'react'
import { currentDataParam, hashFor } from '../../route'
import { runDemo, type DemoDeps } from '../demo/runDemo'
import { TOUR_STEPS } from '../demo/script'
import { anchorFor, flightPath, TOUR_ECHO_SIZE, type Point } from './flightPath'

/** How long Echo takes to fly from one control to the next. The trail fades over TRAIL_MS (CSS). */
export const FLIGHT_MS = 900
/** Longest the tour waits for a control to appear (a page loads on demand). */
const FIND_MS = 1500
const FIND_STEP_MS = 100

export const MISSING_NOTE = 'This control is not on the screen yet. Open a data set and press Next.'

export type TourStop = {
  /** A new number for every flight, so the animation starts again. */
  key: number
  from: Point
  to: Point
  side: 'left' | 'right'
  /** The SVG path Echo flies along, from `from` to `to`. */
  path: string
  selector: string
  /** 'flying' while Echo is on its way, 'arrived' once it points. */
  phase: 'flying' | 'arrived'
  /** Under reduced motion there is no flight and no trail. */
  reduced: boolean
}

export type TourState = {
  active: boolean
  /** 0-based index of the step showing. */
  index: number
  total: number
  caption: string
  stop: TourStop | null
}

const IDLE: TourState = { active: false, index: 0, total: TOUR_STEPS.length, caption: '', stop: null }

let state: TourState = IDLE
let announce: (text: string) => void = () => {}
let controller: AbortController | null = null
let waiter: (() => void) | null = null
let nextQueued = false
let lastPoint: Point | null = null
let flights = 0
const listeners = new Set<() => void>()

function set(update: Partial<TourState>) {
  state = { ...state, ...update }
  listeners.forEach(listener => listener())
}

export const getTour = (): TourState => state
export function subscribeTour(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function useTour(): TourState {
  return useSyncExternalStore(subscribeTour, getTour, getTour)
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Resolves after `ms`, or at once if the tour is stopped. */
const wait = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise(resolve => {
    if (signal.aborted) return resolve()
    const done = () => { window.clearTimeout(timer); signal.removeEventListener('abort', done); resolve() }
    const timer = window.setTimeout(done, ms)
    signal.addEventListener('abort', done)
  })

async function findTarget(selector: string, signal: AbortSignal): Promise<Element | null> {
  for (let waited = 0; waited < FIND_MS; waited += FIND_STEP_MS) {
    const found = document.querySelector(selector)
    if (found || signal.aborted) return found
    await wait(FIND_STEP_MS, signal)
  }
  return document.querySelector(selector)
}

/** A point in the middle of the way, lifted a little so the path curves. */
function bend(from: Point, to: Point): Point {
  const lift = Math.min(120, Math.hypot(to.x - from.x, to.y - from.y) * 0.25)
  return { x: (from.x + to.x) / 2, y: Math.max(TOUR_ECHO_SIZE / 2, (from.y + to.y) / 2 - lift) }
}

function dockPoint(): Point {
  const rect = document.querySelector('.mascot-dock__button')?.getBoundingClientRect()
  if (rect && rect.width > 0) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  return { x: window.innerWidth - TOUR_ECHO_SIZE, y: window.innerHeight - TOUR_ECHO_SIZE }
}

function depsFor(signal: AbortSignal, from: number): DemoDeps {
  let index = from - 1
  return {
    goTo: page => {
      index += 1
      set({ index })
      const hash = hashFor(page, { data: currentDataParam() })
      if (window.location.hash !== hash) window.location.hash = hash
    },
    say: text => { set({ caption: text }); announce(text) },
    // Never called: the tour has no step that plays.
    playAndWait: async () => {},
    // A step ends when the listener presses Next (no timers).
    sleep: (_ms, stopSignal) => new Promise(resolve => {
      if (nextQueued) { nextQueued = false; return resolve() }
      const done = () => { waiter = null; stopSignal.removeEventListener('abort', done); resolve() }
      waiter = done
      stopSignal.addEventListener('abort', done)
    }),
    pointAt: async selector => {
      // A run that was stopped (or replaced by Back) must not clear what the new one shows.
      if (signal.aborted) return
      if (selector === null) { set({ stop: null }); return }
      const target = await findTarget(selector, signal)
      if (signal.aborted) return
      if (!target) {
        const note = `${state.caption} ${MISSING_NOTE}`
        set({ stop: null, caption: note })
        announce(MISSING_NOTE)
        return
      }
      if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' })
      const rect = target.getBoundingClientRect()
      const place = anchorFor(rect, { w: window.innerWidth, h: window.innerHeight })
      const to = { x: place.x, y: place.y }
      const start = lastPoint ?? dockPoint()
      const reduced = prefersReducedMotion()
      lastPoint = to
      flights += 1
      const stop: TourStop = { key: flights, from: start, to, side: place.side, path: flightPath([start, bend(start, to), to]), selector, phase: reduced ? 'arrived' : 'flying', reduced }
      set({ stop })
      if (reduced) return
      await wait(FLIGHT_MS, signal)
      if (!signal.aborted && state.stop?.key === stop.key) set({ stop: { ...stop, phase: 'arrived' } })
    },
  }
}

function run(from: number) {
  controller?.abort()
  const mine = new AbortController()
  controller = mine
  waiter = null
  nextQueued = false
  void runDemo(TOUR_STEPS.slice(from), depsFor(mine.signal, from), mine.signal).then(finished => {
    if (controller !== mine) return
    controller = null
    lastPoint = null
    const caption = finished ? 'The tour has finished.' : 'The tour was stopped.'
    set({ ...IDLE, caption })
    announce(caption)
  })
}

/** Starts the tour from the first stop. `say` is how the captions reach a screen reader (the app's announcer). */
export function startTour(say: (text: string) => void) {
  if (controller) return
  announce = say
  lastPoint = dockPoint()
  set({ ...IDLE, active: true })
  run(0)
}

export function nextStep() {
  if (!state.active) return
  const wake = waiter
  if (wake) wake()
  else nextQueued = true
}

export function backStep() {
  if (!state.active || state.index <= 0) return
  run(state.index - 1)
}

export function stopTour() {
  if (!controller) return
  controller.abort()
}
