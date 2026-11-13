// Follow a hot spot through time (ticket IX03). H picks a spot (the one under the cursor, or the largest) and the dates play on, one step at a time, while the
// cursor stays on the spot and its own note sounds on each date. When the spot is gone the end figure plays, and the words go through the speech gate.
// [ and ] change the spot. H, Escape, the explorer going off or a new data set stop it. Starting, stopping and changing the spot can be undone.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Pixels } from '../../analysis/analyze'
import { extractFeatures, type FrameFeatures, type Hotspot } from '../../analysis/features'
import { baseInput, baselineFor, defaultLoadPixels } from '../../analysis/video/input'
import type { Ensemble } from '../../audio/ensemble/types'
import { elevationForPoint, panForPoint } from '../../audio/pan'
import { useAnnounce } from '../../components'
import type { Frame, Visualization } from '../../data'
import { createFeedback } from '../../interaction/feedback'
import { recordUndo } from '../../interaction/history'
import { cellOfFraction, noteForPosition } from '../../interaction/notes'
import { useActionHandler } from '../../interaction/registry'
import { createSpeechGate } from '../../interaction/speech'
import { presetFor, toMusicFrame } from '../../sonify'
import type { MusicFrame } from '../../sonify/types'
import type { ExplorerState } from '../explore/useExplorer'
import { pickHotspot, stepHotspot } from './pick'

/** One date per step while following, as the locked place plays across the dates. */
export const FOLLOW_STEP_MS = 600
export const FOLLOW_NOTE_SECONDS = 0.3
export const FOLLOW_LEVEL = 0.5
export const GONE_TEXT = 'The hot spot has gone from the map.'
export const NONE_TEXT = 'There is no hot spot on this date.'
export const FAILED_TEXT = 'The hot spots could not be read.'
export const FINDING_TEXT = 'Finding the hot spots…'
export const followingText = (id: string) => `Following hot spot ${id}.`

/** What follow needs of the sound map. */
export type FollowExplorer = Pick<ExplorerState, 'on' | 'grid' | 'cursor' | 'area' | 'locked' | 'moveTo'> & {
  ensemble: Pick<Ensemble, 'playNotes' | 'playDropout' | 'now' | 'status' | 'start'>
}

export type Tracks = { features: FrameFeatures[]; music: MusicFrame[] }

/**
 * The features and music of every date, read one after another so each frame carries the last one's hot-spot ids (SN01) and music state (SN03), as the
 * offline render does. Read once per data set, the first time a spot is followed.
 */
export async function readTracks(visualization: Visualization, frames: Frame[], loadPixels: (url: string) => Promise<Pixels>): Promise<Tracks> {
  const preset = presetFor(visualization.sonification?.preset ?? 'major')
  const features: FrameFeatures[] = []
  const music: MusicFrame[] = []
  for (const frame of frames) {
    const [pixels, baseline] = await Promise.all([loadPixels(frame.image), baselineFor(visualization, frame.date, loadPixels)])
    const made = extractFeatures(pixels, { ...baseInput(visualization, frame.id, frame.date, 1), baseline }, features.at(-1))
    features.push(made)
    music.push(toMusicFrame(made, preset, music.at(-1) ?? null))
  }
  return { features, music }
}

type Options = {
  visualization: Visualization
  explorer: FollowExplorer
  /** The dates, in the order the player shows them. */
  frames: Frame[]
  /** The date on screen. */
  index: number
  /** Shows a date without playing the whole map, as the locked place does. */
  showDate: (index: number) => void
  /** How the dates are read. For tests; by default each picture is read with the app's reader. */
  read?: (visualization: Visualization, frames: Frame[]) => Promise<Tracks>
}

export type FollowState = ReturnType<typeof useFollow>

const readWithApp = (visualization: Visualization, frames: Frame[]) => readTracks(visualization, frames, defaultLoadPixels)

export function useFollow({ visualization, explorer, frames, index, showDate, read = readWithApp }: Options) {
  const announce = useAnnounce()
  const preset = useMemo(() => presetFor(visualization.sonification?.preset ?? 'major'), [visualization])
  const feedback = useMemo(() => createFeedback(explorer.ensemble, preset), [explorer.ensemble, preset])
  const gate = useMemo(() => createSpeechGate(), [])

  /** What the panel says. It is cleared when the sound map goes off or the data set changes (set during render, React's way of resetting state on a prop). */
  const [text, setText] = useState('')
  const [shownFor, setShownFor] = useState({ on: explorer.on, visualization })
  if (shownFor.on !== explorer.on || shownFor.visualization !== visualization) {
    setShownFor({ on: explorer.on, visualization })
    setText('')
  }

  /** The followed track id. A ref, so the step timer and the handlers always read the newest. */
  const followed = useRef<string | null>(null)
  const tracks = useRef<{ of: Visualization; read: Promise<Tracks> } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  /** The spot as last heard, for the end figure and for undo. */
  const last = useRef<Hotspot | null>(null)
  /** Moves on whenever follow starts or stops, so a slow read of the dates cannot start a follow that was cancelled meanwhile. */
  const attempt = useRef(0)
  /** A start is waiting for the dates to be read. */
  const pending = useRef(false)
  // Read by the timer and the promise callbacks, which outlive a render. The grid size is kept while a new date's map is being read.
  const latest = useRef({ explorer, frames, index, showDate, dims: explorer.grid ? { cols: explorer.grid.cols, rows: explorer.grid.rows } : null })
  useEffect(() => {
    const dims = explorer.grid ? { cols: explorer.grid.cols, rows: explorer.grid.rows } : latest.current.dims
    latest.current = { explorer, frames, index, showDate, dims }
  })

  const tracksFor = useCallback((v: Visualization) => {
    if (tracks.current?.of !== v) tracks.current = { of: v, read: read(v, latest.current.frames) }
    return tracks.current.read
  }, [read])

  /** Drops the step timer, the followed spot and any start still waiting. */
  const halt = useCallback(() => {
    attempt.current++
    pending.current = false
    window.clearTimeout(timer.current)
    timer.current = undefined
    followed.current = null
  }, [])

  /** Stops following. 'lost' plays the end figure and says so, through the gate; 'quiet' does neither. */
  const end = useCallback((how: 'lost' | 'quiet') => {
    const spot = last.current
    halt()
    last.current = null
    if (how === 'lost' && spot) {
      feedback.unlock({ position: spot.peakPosition, pan: panForPoint(spot.centroid.x), elevation: elevationForPoint(spot.centroid.y) })
      setText(GONE_TEXT)
      if (gate.allow(Date.now())) announce(GONE_TEXT)
    } else setText('')
  }, [halt, feedback, gate, announce])

  /** Puts the cursor on the spot on date `k` and sounds its note. False when the spot is not on that date. */
  const visit = useCallback((read: Tracks, k: number, id: string): boolean => {
    const spot = read.features[k]?.hotspots.find(candidate => candidate.id === id)
    const { explorer: map, dims } = latest.current
    if (!spot || !dims) return false
    const cell = cellOfFraction(spot.centroid.x, spot.centroid.y, map.area, dims.cols, dims.rows)
    map.moveTo(cell.col, cell.row, 'follow')
    // The note the Symphony hot-spot voice plays for this spot (SN03); a spot past that voice's limit gets the note of its strongest value.
    const voice = read.music[k]?.hotspots.find(note => note.id === id)
    map.ensemble.playNotes([{
      midi: voice?.midi ?? noteForPosition(spot.peakPosition, preset),
      pan: voice?.pan ?? panForPoint(spot.centroid.x),
      elevation: voice?.elevation ?? elevationForPoint(spot.centroid.y),
      level: FOLLOW_LEVEL,
      seconds: FOLLOW_NOTE_SECONDS,
    }])
    last.current = spot
    return true
  }, [preset])

  /** Date `k` is on screen: stay on the spot, or end follow if it has gone. Then on to the next date, if there is one. A ref, so the timer can call it again. */
  const arrive = useRef<(read: Tracks, k: number) => void>(() => {})
  useEffect(() => {
    arrive.current = (read, k) => {
      const id = followed.current
      if (!id) return
      window.clearTimeout(timer.current)
      timer.current = undefined
      if (!visit(read, k, id)) { end('lost'); return }
      if (k + 1 >= latest.current.frames.length) return
      timer.current = window.setTimeout(() => {
        timer.current = undefined
        if (followed.current !== id) return
        latest.current.showDate(k + 1)
        arrive.current(read, k + 1)
      }, FOLLOW_STEP_MS)
    }
  })

  /** Follows `spot` from the date on screen. */
  const follow = useCallback((read: Tracks, spot: Hotspot) => {
    halt()
    followed.current = spot.id
    setText(followingText(spot.id))
    arrive.current(read, latest.current.index)
  }, [halt])

  /** Reads the dates if need be, then follows the spot `choose` gives, or says there is none. Undo goes back to the spot before, or to not following. */
  const start = useCallback((choose: (features: FrameFeatures) => Hotspot | null) => {
    const before = followed.current ? last.current : null
    halt()
    const mine = attempt.current
    pending.current = true
    if (tracks.current?.of !== visualization) setText(FINDING_TEXT)
    tracksFor(visualization).then(read => {
      if (mine !== attempt.current) return
      pending.current = false
      const spot = choose(read.features[latest.current.index])
      if (!spot) { setText(NONE_TEXT); announce(NONE_TEXT); return }
      follow(read, spot)
      recordUndo('follow', () => {
        if (followed.current !== spot.id) return
        if (before) follow(read, before)
        else end('quiet')
      })
    }, () => {
      if (mine !== attempt.current) return
      pending.current = false
      tracks.current = null
      setText(FAILED_TEXT)
      announce(FAILED_TEXT)
    })
  }, [visualization, halt, tracksFor, follow, end, announce])

  useActionHandler('follow', action => {
    if (!explorer.on || !explorer.grid) return
    if (explorer.locked) { announce('Locked on this place. Press L to unlock before following a hot spot.'); return }
    // The press starts the audio (WCAG 1.4.2): follow's notes go through the map's ensemble.
    if (explorer.ensemble.status() !== 'on') explorer.ensemble.start().catch(() => {})
    if (action.step === 'toggle' && (followed.current || pending.current)) {
      const spot = last.current
      end('quiet')
      if (spot) recordUndo('follow', () => { if (!followed.current) void tracksFor(visualization).then(read => { if (!followed.current) follow(read, spot) }) })
      return
    }
    if (action.step === 'toggle') {
      const { grid, cursor, area } = explorer
      const centre = { x: area.x0 + ((cursor.col + 0.5) / grid.cols) * (area.x1 - area.x0), y: area.y0 + ((cursor.row + 0.5) / grid.rows) * (area.y1 - area.y0) }
      start(features => pickHotspot(features, centre, area))
    } else {
      const current = followed.current
      const step = action.step
      start(features => stepHotspot(features, current, step))
    }
  })

  // Escape stops follow (and a start still waiting) with the rest of the sound.
  useActionHandler('stopSpeech', () => {
    if (followed.current || pending.current || timer.current !== undefined) end('quiet')
  })

  /** The listener chose a date (the slider): stay on the spot there, and play on from it. Returns false when nothing is followed. */
  const showFollowedDate = useCallback((k: number) => {
    const known = tracks.current
    if (!followed.current || !known) return false
    void known.read.then(read => arrive.current(read, k))
    return true
  }, [])

  // The sound map going off, a new data set, or leaving the page ends follow.
  const on = explorer.on
  useEffect(() => {
    if (!on) { halt(); last.current = null }
    return () => { halt(); last.current = null }
  }, [on, visualization, halt])

  return {
    /** The panel's line, shown only while the sound map is on. */
    text: explorer.on ? text : '',
    /** True while a spot is followed. */
    isFollowing: () => followed.current !== null,
    showFollowedDate,
  }
}
