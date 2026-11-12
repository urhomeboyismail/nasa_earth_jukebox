// The explorer's continuous tone (docs/PLAN.md §6.3 "Explore", ticket SN09): what the cursor, a finger or the arrow keys are on, held as one tone that
// glides from cell to cell, with the slope cue in its brightness. It sends the ensemble at most 20 tones a second, the latest always winning, and each
// sounds within 50 ms. A cell with no data plays the dropout cue. Also the stored "Continuous tone" and "Slope cue" choices.

import { useCallback, useState } from 'react'
import type { FrameGrid } from '../../analysis'
import { INTERACTIVE_LOOKAHEAD_S, MIN_APPLY_GAP_S } from '../../audio/ensemble/constants'
import type { Ensemble, HeldTone } from '../../audio/ensemble/types'
import type { ColorScale } from '../../data'
import { probeTone } from '../../sonify/probe'
import type { Preset } from '../../sonify/types'

/** An arrow key holds the tone this long; another key in the meantime extends it. */
export const KEY_TONE_MS = 300
const GAP_MS = MIN_APPLY_GAP_S * 1000

/** What the probe needs of the ensemble. */
export type ProbeEnsemble = Pick<Ensemble, 'start' | 'hold' | 'playDropout' | 'now' | 'status'>

/** The map the probe reads: the explorer's own grid, so a cell and its sound never disagree. */
export type ProbeMap = { grid: FrameGrid; colorScale: ColorScale; slopeCue: boolean }

export type ProbeAudio = {
  /** The map on screen (`null` while it is being read). The explorer sets it whenever the map or the slope-cue choice changes. */
  setMap(next: ProbeMap | null): void
  /** The pointer is on this cell (a move, or the first touch). */
  point(col: number, row: number): void
  /** An arrow key moved to this cell: the tone holds for KEY_TONE_MS. */
  key(col: number, row: number): void
  /** Pointer up, the pointer left the map, or Escape: the tone stops now. */
  leave(): void
  /** Starts the ensemble. Call it from a click or key press only; a tone held meanwhile sounds once it has started. */
  start(): void
  /** Stops the timers and the tone. The probe can still be used afterwards (StrictMode runs an effect's cleanup and then the effect again). */
  dispose(): void
}

export function createProbeAudio(ensemble: ProbeEnsemble, preset: Preset, clock: () => number = () => performance.now()): ProbeAudio {
  /** The map on screen; null until it has been read. */
  let map: ProbeMap | null = null
  let lastSent = -Infinity
  /** The tone waiting for the end of the gap; `undefined` when nothing waits. */
  let pending: HeldTone | null | undefined
  let sendTimer: number | undefined
  let releaseTimer: number | undefined
  /** The tone that should be sounding now. */
  let current: HeldTone | null = null
  /** The last cell was empty, so moving on through the empty area does not repeat the dropout cue. */
  let inEmpty = false
  let starting = false

  function flush() {
    sendTimer = undefined
    if (pending === undefined) return
    const tone = pending
    pending = undefined
    lastSent = clock()
    ensemble.hold(tone, ensemble.now() + INTERACTIVE_LOOKAHEAD_S)
  }

  /** At most one tone per gap; one sent inside the gap replaces any that is waiting and goes at the gap's end. */
  function send(tone: HeldTone | null) {
    current = tone
    pending = tone
    const wait = lastSent + GAP_MS - clock()
    if (wait <= 0) flush()
    else sendTimer ??= window.setTimeout(flush, wait)
  }

  function release() {
    window.clearTimeout(sendTimer)
    window.clearTimeout(releaseTimer)
    sendTimer = releaseTimer = undefined
    pending = undefined
    current = null
    inEmpty = false
    lastSent = clock()
    ensemble.hold(null, ensemble.now() + INTERACTIVE_LOOKAHEAD_S)
  }

  /** Sounds a cell. A key press on an empty cell always plays the cue; a pointer plays it once on entering the empty area. */
  function sound(col: number, row: number, byKey: boolean) {
    const read = map
    if (!read) return
    const tone = probeTone(read.colorScale, read.grid, col, row, preset)
    if (tone === null) {
      if (byKey || !inEmpty) ensemble.playDropout(ensemble.now() + INTERACTIVE_LOOKAHEAD_S)
      inEmpty = true
      send(null)
      return
    }
    inEmpty = false
    send(read.slopeCue ? tone : { ...tone, brightness: 0.5 })
  }

  return {
    setMap(next) { map = next },
    point(col, row) {
      window.clearTimeout(releaseTimer)
      releaseTimer = undefined
      sound(col, row, false)
    },
    key(col, row) {
      sound(col, row, true)
      window.clearTimeout(releaseTimer)
      releaseTimer = window.setTimeout(release, KEY_TONE_MS)
    },
    leave: release,
    start() {
      if (starting || ensemble.status() === 'on') return
      starting = true
      ensemble.start().then(
        () => {
          starting = false
          // A tone held while the sound was starting was not heard: send it again.
          if (current) {
            lastSent = -Infinity
            send(current)
          }
        },
        () => { starting = false },
      )
    },
    dispose() {
      window.clearTimeout(sendTimer)
      window.clearTimeout(releaseTimer)
      sendTimer = releaseTimer = undefined
      pending = undefined
      if (current) ensemble.hold(null)
      current = null
      inEmpty = false
    },
  }
}

const TONE_KEY = 'earth-jukebox:explore-tone'
const SLOPE_KEY = 'earth-jukebox:explore-slope'

/** 'on', 'off', or null when nothing is stored. Storage can be blocked (private windows), so every access is guarded. */
function readChoice(key: string): boolean | null {
  try {
    const stored = localStorage.getItem(key)
    return stored === 'on' ? true : stored === 'off' ? false : null
  } catch {
    return null
  }
}

function storeChoice(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // Not remembered, but the choice still holds for this visit.
  }
}

export type ProbeSettings = { tone: boolean; slopeCue: boolean; setTone: (on: boolean) => void; setSlopeCue: (on: boolean) => void }

/**
 * The "Continuous tone" and "Slope cue" choices. A stored choice wins. Otherwise the tone is on for a data set with a `sonification` block and off
 * for one without (which keeps one note per cell); the slope cue is on.
 */
export function useProbeSettings(sonified: boolean): ProbeSettings {
  const [storedTone, setStoredTone] = useState(() => readChoice(TONE_KEY))
  const [storedSlope, setStoredSlope] = useState(() => readChoice(SLOPE_KEY))
  const setTone = useCallback((on: boolean) => { setStoredTone(on); storeChoice(TONE_KEY, on) }, [])
  const setSlopeCue = useCallback((on: boolean) => { setStoredSlope(on); storeChoice(SLOPE_KEY, on) }, [])
  return { tone: storedTone ?? sonified, slopeCue: storedSlope ?? true, setTone, setSlopeCue }
}
