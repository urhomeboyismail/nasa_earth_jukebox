// The sound map's state (docs/PLAN.md §5.6, ticket T81): the cursor, the keys, touch and mouse, and the sweep. Kept apart from the components in
// Explorer.tsx so that file only exports components (fast refresh).

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { analyzeGrid, type FrameGrid } from '../../analysis'
import type { SequenceStep, SoundEngine } from '../../audio'
import { useEnsemble } from '../../audio/ensemble/useEnsemble'
import { elevationForPoint, panForPoint } from '../../audio/pan'
import { presetFor } from '../../sonify/presets'
import { useAnnounce } from '../../components'
import type { Frame, MapArea, Visualization } from '../../data'
import { describeCell, describeCellOverTime, describePlace, describeSweep, edgeMessage, explorerMessage, sweepEndMessage, type Edge } from '../../describe'
import { useDescriptionDetail } from '../../describe/detail'
import { shortcutFor } from '../player/shortcuts'
import { vibrateForDate } from '../player/vibration'
import { createProbeAudio, useProbeSettings, type ProbeAudio } from './probeAudio'

/** A moved cursor plays at most this often; the latest cell wins. */
const PLAY_EVERY_MS = 120
/** The announcement waits for the cursor to rest, so a screen reader is not talking over the sounds. */
const ANNOUNCE_AFTER_MS = 400
/** One cell of a sweep per step. */
const SWEEP_STEP_MS = 250
const CELL_NOTE_MS = 300
/** One date of a locked place per step when it plays across the dates. */
const DATE_STEP_MS = 600
const BIG_STEP = 4
const WHOLE_MAP: MapArea = { x0: 0, y0: 0, x1: 1, y1: 1 }

type Cursor = { col: number; row: number }
type Line = 'row' | 'column'

type MapRead = { frame: Frame; colorScale: Visualization['colorScale']; mapping: Visualization['mapping']; mapArea: MapArea | undefined; grid: FrameGrid | null; error: string }

type Options = {
  visualization: Visualization
  frame: Frame
  engine: SoundEngine | null
  /** Buzz for each cell when the listener has vibration on. */
  vibrate: boolean
  /** Every date of the data set, for the locked place (F23). */
  frames: Frame[]
  /** How a date is shown and spoken. Default: the date as written in the data. */
  formatDate?: (date: string) => string
  /** Called as the locked place plays across the dates, so the picture and the date slider follow the sound. */
  onDate?: (index: number) => void
  /** F40: open on this cell, as a link asks. It makes no sound until the first key press or touch, which is also what unlocks the audio. */
  start?: Cursor | null
  /**
   * SN09: the continuous tone. Left out, the explorer makes its own on the data set's preset while "Continuous tone" is on; `null` keeps one note
   * per cell. While a probe is in use, a cell is heard through it instead of the engine's note.
   */
  probe?: ProbeAudio | null
}

export type ExplorerState = ReturnType<typeof useExplorer>

export function useExplorer({ visualization, frame, engine, vibrate, frames, formatDate = date => date, onDate, start = null, probe: given }: Options) {
  const { colorScale, mapping } = visualization
  const area = visualization.mapArea ?? WHOLE_MAP
  const announce = useAnnounce()
  const [detail] = useDescriptionDetail()

  // SN09: the explorer's own ensemble and probe. Nothing loads or sounds until the first press starts it.
  const probeSettings = useProbeSettings(visualization.sonification !== undefined)
  const preset = presetFor(visualization.sonification?.preset ?? 'major')
  const { ensemble } = useEnsemble(preset, 'full')
  const ownProbe = useMemo(() => createProbeAudio(ensemble, preset), [ensemble, preset])
  useEffect(() => () => ownProbe.dispose(), [ownProbe])
  const probe = given !== undefined ? given : probeSettings.tone ? ownProbe : null

  const [on, setOn] = useState(start !== null)
  // The map read for one date. It counts only while it matches the date and settings on screen, so a new date shows "loading" at once.
  const [read, setRead] = useState<MapRead | null>(null)
  const current = on && read && read.frame === frame && read.colorScale === colorScale && read.mapping === mapping && read.mapArea === visualization.mapArea ? read : null
  const grid = current?.grid ?? null
  const error = current?.error ?? ''
  // The probe reads the map on screen, with the slope-cue choice.
  useEffect(() => {
    probe?.setMap(grid ? { grid, colorScale, slopeCue: probeSettings.slopeCue } : null)
  }, [probe, grid, colorScale, probeSettings.slopeCue])
  const [cursor, setCursor] = useState<Cursor>(start ?? { col: 0, row: 0 })
  const [sweeping, setSweeping] = useState(false)
  /** F23: the cursor is locked on one place, and the dates move under it. */
  const [locked, setLocked] = useState(false)
  /** The map of each date, read once: locking and scrubbing ask for the same dates again and again. */
  const gridCache = useRef(new Map<string, FrameGrid>())

  // Timers and counters that must not cause a render.
  const sweepId = useRef(0)
  const announceTimer = useRef<number | undefined>(undefined)
  const playTimer = useRef<number | undefined>(undefined)
  const lastPlayed = useRef(-Infinity)
  const sweepEnd = useRef<number | undefined>(undefined)
  /** True until the first message after turning on, or after the date changed, has been said: that message starts with the date. */
  const needDate = useRef(true)
  // A linked cell counts as already placed, so the first read keeps it (unless it is off the map).
  const placed = useRef(start !== null)
  /** Opened by a link: the audio is not unlocked yet. The first key press or touch does it and then plays the cell it lands on. */
  const needsUnlock = useRef(start !== null)
  /** A locked place is playing across the dates. The date moves under it, which must not stop it the way a new date stops a sweep. */
  const scrubbing = useRef(false)
  const cursorRef = useRef(cursor)
  /** Sets the cursor everywhere at once, so a second key pressed before the next render still starts from the right cell. */
  const place = useCallback((next: Cursor) => { cursorRef.current = next; setCursor(next) }, [])

  const clearTimers = useCallback(() => {
    window.clearTimeout(announceTimer.current)
    window.clearTimeout(playTimer.current)
    window.clearTimeout(sweepEnd.current)
    playTimer.current = undefined
  }, [])

  const stopSweep = useCallback(() => {
    sweepId.current++
    scrubbing.current = false
    window.clearTimeout(sweepEnd.current)
    setSweeping(false)
  }, [])

  // Read the map of the date on screen. A new date reloads it; the cursor stays where it was.
  useEffect(() => {
    if (!on) return
    let cancelled = false
    needDate.current = true
    const { mapArea } = visualization
    analyzeGrid(frame, colorScale, mapping, mapArea)
      .then(done => {
        if (cancelled) return
        setRead({ frame, colorScale, mapping, mapArea, grid: done, error: '' })
        // The first read puts the cursor in the middle; a later date keeps it where it was.
        gridCache.current.set(`${visualization.id}/${frame.id}`, done)
        const now = cursorRef.current
        if (!(placed.current && now.col < done.cols && now.row < done.rows)) {
          place({ col: Math.floor(done.cols / 2), row: Math.floor(done.rows / 2) })
        }
        placed.current = true
      })
      .catch((failure: unknown) => {
        if (!cancelled) setRead({ frame, colorScale, mapping, mapArea, grid: null, error: failure instanceof Error ? failure.message : String(failure) })
      })
    return () => {
      cancelled = true
      if (!scrubbing.current) {
        stopSweep()
        clearTimers()
      }
    }
  }, [on, frame, colorScale, mapping, visualization, clearTimers, place, stopSweep])

  useEffect(() => clearTimers, [clearTimers])

  const cellAt = useCallback((col: number, row: number) => grid?.cells[row * grid.cols + col], [grid])
  /** The middle of a column as a fraction of the whole image (not just of the map), so the pan matches the picture. */
  const centreX = useCallback((col: number) => grid ? area.x0 + ((col + 0.5) / grid.cols) * (area.x1 - area.x0) : 0.5, [grid, area])
  /** The height of a row: north is up, as a fraction of the whole image like the pan. Heard only in 3D mode. */
  const elevationAt = useCallback((row: number) => elevationForPoint(grid ? area.y0 + ((row + 0.5) / grid.rows) * (area.y1 - area.y0) : 0.5), [grid, area])

  const announceCell = useCallback((at: Cursor, delay: number) => {
    window.clearTimeout(announceTimer.current)
    if (!grid) return
    const say = () => {
      // The date goes in the first message after turning on or after a date change; later moves leave it out.
      const date = needDate.current ? formatDate(frame.date) : undefined
      needDate.current = false
      announce(explorerMessage(describeCell(visualization, grid, at.col, at.row, { detail }), detail, date))
    }
    if (delay <= 0) say()
    else announceTimer.current = window.setTimeout(say, delay)
  }, [grid, visualization, announce, detail, formatDate, frame.date])

  /** Sounds a cell now, or after the pause between plays; a newer cell replaces one that is waiting. */
  const soundCell = useCallback((at: Cursor) => {
    if (!engine || !grid) return
    window.clearTimeout(playTimer.current)
    const play = () => {
      lastPlayed.current = Date.now()
      playTimer.current = undefined
      const cell = grid.cells[at.row * grid.cols + at.col]
      if (!cell) return
      if (cell.category === 'insufficient') engine.playMissing()
      else engine.playCategory(cell.category, { pan: panForPoint(centreX(at.col)), elevation: elevationAt(at.row), durationMs: CELL_NOTE_MS })
      if (vibrate) vibrateForDate(cell.category, mapping)
    }
    const wait = PLAY_EVERY_MS - (Date.now() - lastPlayed.current)
    if (wait <= 0) play()
    else playTimer.current = window.setTimeout(play, wait)
  }, [engine, grid, centreX, elevationAt, vibrate, mapping])

  /** In a link-opened map, the first press unlocks the audio (it has to happen in the press) and then sounds the cell the cursor is on. */
  const wake = useCallback(() => {
    if (!needsUnlock.current || !engine) return
    needsUnlock.current = false
    // With the continuous tone on, the probe sounds the cell once its own sound has started.
    void engine.unlock().then(() => { if (!probe) soundCell(cursorRef.current) })
  }, [engine, soundCell, probe])

  /**
   * Moves the cursor and plays the cell. `speak` is false for the sliders, which are announced by the screen reader itself. With the continuous
   * tone on, a pointer holds the tone while it stays and anything else (keys, sliders) holds it briefly; the engine's note is not played.
   */
  const moveTo = useCallback((col: number, row: number, speak = true, by: 'key' | 'pointer' = 'key') => {
    if (!grid || locked) return
    const next = { col: Math.min(grid.cols - 1, Math.max(0, col)), row: Math.min(grid.rows - 1, Math.max(0, row)) }
    stopSweep()
    place(next)
    if (probe) {
      if (by === 'pointer') probe.point(next.col, next.row)
      else probe.key(next.col, next.row)
      const cell = grid.cells[next.row * grid.cols + next.col]
      if (vibrate && cell) vibrateForDate(cell.category, mapping)
    } else {
      soundCell(next)
    }
    if (speak) announceCell(next, ANNOUNCE_AFTER_MS)
  }, [grid, locked, stopSweep, place, probe, vibrate, mapping, soundCell, announceCell])

  /** A key that pushes against the edge of the map: no sound, and the edge is named once the keys rest, so a held key is not heard as a stall. */
  const hitEdge = useCallback((edge: Edge) => {
    stopSweep()
    window.clearTimeout(announceTimer.current)
    announceTimer.current = window.setTimeout(() => announce(edgeMessage(edge)), ANNOUNCE_AFTER_MS)
  }, [stopSweep, announce])

  /** A move by key. Plays and announces the new cell like `moveTo`; if the cursor cannot move, it says which edge instead. */
  const moveByKey = useCallback((col: number, row: number, edge: Edge) => {
    if (!grid) return
    if (locked) {
      announce('Locked on this place. Press L to unlock before moving.')
      return
    }
    const at = cursorRef.current
    const target = { col: Math.min(grid.cols - 1, Math.max(0, col)), row: Math.min(grid.rows - 1, Math.max(0, row)) }
    if (target.col === at.col && target.row === at.row) hitEdge(edge)
    else moveTo(target.col, target.row)
  }, [grid, locked, moveTo, hitEdge, announce])

  /** Plays a row west to east, or a column north to south, one cell at a time, then says what it passed over. */
  const sweep = useCallback((kind: Line) => {
    if (!engine || !grid) return
    stopSweep()
    window.clearTimeout(announceTimer.current)
    window.clearTimeout(playTimer.current)
    const mine = ++sweepId.current
    const at = cursorRef.current
    const length = kind === 'row' ? grid.cols : grid.rows
    const cells: Cursor[] = Array.from({ length }, (_, k) => (kind === 'row' ? { col: k, row: at.row } : { col: at.col, row: k }))
    const steps: SequenceStep[] = cells.map((cell, k) => ({
      category: grid.cells[cell.row * grid.cols + cell.col].category,
      atMs: k * SWEEP_STEP_MS,
      pan: panForPoint(centreX(cell.col)),
      elevation: elevationAt(cell.row),
    }))
    setSweeping(true)
    engine.playSequence(steps, k => {
      if (mine !== sweepId.current) return
      place(cells[k])
      if (k === steps.length - 1) {
        sweepEnd.current = window.setTimeout(() => {
          if (mine !== sweepId.current) return
          setSweeping(false)
          announce(sweepEndMessage(describeSweep(visualization, grid, { kind, index: kind === 'row' ? at.row : at.col }, { detail }), detail))
        }, SWEEP_STEP_MS)
      }
    }, { tick: false })
  }, [engine, grid, centreX, elevationAt, stopSweep, place, announce, visualization, detail])

  /** Stops the sound of a sweep or cell, keeping the cursor where it is. */
  const stopSound = useCallback(() => {
    stopSweep()
    clearTimers()
    engine?.stop()
    probe?.leave()
  }, [stopSweep, clearTimers, engine, probe])

  /** The map of any date, from the cache or read now. */
  const gridFor = useCallback(async (of: Frame) => {
    const key = `${visualization.id}/${of.id}`
    const known = gridCache.current.get(key)
    if (known) return known
    const made = await analyzeGrid(of, colorScale, mapping, visualization.mapArea)
    gridCache.current.set(key, made)
    return made
  }, [visualization.id, visualization.mapArea, colorScale, mapping])

  /** F23: holds the cursor on this place, so the dates can be heard one after another at the same spot. */
  const lock = useCallback(() => {
    if (!grid) return
    stopSweep()
    clearTimers()
    setLocked(true)
    announce(`Locked on ${describePlace(grid, cursorRef.current.col, cursorRef.current.row)}. Move the date slider, or play across the dates. L or Escape unlocks.`)
  }, [grid, stopSweep, clearTimers, announce])

  const unlock = useCallback(() => {
    if (!locked) return
    stopSweep()
    setLocked(false)
    announce('Unlocked. The arrow keys move over the map again.')
  }, [locked, stopSweep, announce])

  /** Sounds the locked place on one date and says what it was then. The date slider calls this while the place is locked. */
  const playLockedAt = useCallback(async (index: number) => {
    const target = frames[index]
    if (!engine || !locked || !target) return
    stopSweep()
    window.clearTimeout(announceTimer.current)
    const at = cursorRef.current
    let made: FrameGrid
    try { made = await gridFor(target) } catch { announce('That date could not be read.'); return }
    const cell = made.cells[at.row * made.cols + at.col]
    if (!cell) return
    engine.stop()
    if (cell.category === 'insufficient') engine.playMissing()
    else engine.playCategory(cell.category, { pan: panForPoint(centreX(at.col)), elevation: elevationAt(at.row), durationMs: CELL_NOTE_MS })
    if (vibrate && cell.category !== 'insufficient') vibrateForDate(cell.category, mapping)
    announce(`${formatDate(target.date)}: ${describeCell(visualization, made, at.col, at.row, { detail })}`)
  }, [frames, engine, locked, stopSweep, gridFor, centreX, elevationAt, vibrate, mapping, announce, formatDate, visualization, detail])

  /** Plays the locked place on every date, one after another, and then says how it changed. */
  const playAcrossDates = useCallback(async () => {
    if (!engine || !locked || !grid) return
    stopSweep()
    window.clearTimeout(announceTimer.current)
    window.clearTimeout(playTimer.current)
    const mine = ++sweepId.current
    const at = cursorRef.current
    scrubbing.current = true
    setSweeping(true)
    let grids: FrameGrid[]
    try { grids = await Promise.all(frames.map(gridFor)) } catch {
      if (mine === sweepId.current) { scrubbing.current = false; setSweeping(false); announce('The dates could not be read.') }
      return
    }
    if (mine !== sweepId.current) return
    const cells = grids.map(made => made.cells[at.row * made.cols + at.col])
    const pan = panForPoint(centreX(at.col))
    const elevation = elevationAt(at.row)
    const steps: SequenceStep[] = cells.map((cell, k) => ({
      category: cell.category,
      atMs: k * DATE_STEP_MS,
      pan,
      elevation,
      ...(k > 0 && cell.category !== 'insufficient' && cells[k - 1].category !== 'insufficient' && { glide: true }),
    }))
    engine.playSequence(steps, k => {
      if (mine !== sweepId.current) return
      onDate?.(k)
      if (k === steps.length - 1) {
        sweepEnd.current = window.setTimeout(() => {
          if (mine !== sweepId.current) return
          scrubbing.current = false
          setSweeping(false)
          announce(`${describePlace(grid, at.col, at.row)}. ${describeCellOverTime(visualization, cells.map((cell, i) => ({ date: formatDate(frames[i].date), cell })), { detail })}`)
        }, DATE_STEP_MS)
      }
    }, { tick: false })
  }, [engine, locked, grid, frames, gridFor, stopSweep, centreX, elevationAt, onDate, announce, formatDate, visualization, detail])

  const turnOn = useCallback(() => {
    // The first press has to start the audio, so it is asked for here, in the click.
    void engine?.unlock()
    probe?.start()
    needsUnlock.current = false
    setOn(true)
  }, [engine, probe])

  /** F40: a link pasted into the open page. Opens the map on that cell, silently. A cell off the map is ignored, and a locked place is released. */
  const openAt = useCallback((at: Cursor) => {
    if (grid && (at.col >= grid.cols || at.row >= grid.rows)) return
    stopSweep()
    setLocked(false)
    place(at)
    placed.current = true
    if (!on) needsUnlock.current = true
    setOn(true)
  }, [grid, on, stopSweep, place])

  const turnOff = useCallback(() => {
    setOn(false)
    setRead(null)
    setLocked(false)
    placed.current = false
    stopSound()
  }, [stopSound])

  /** The keyboard. Every key handled here is also stopped from reaching the player's own shortcuts. */
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    // Which key means what is the list in ../player/shortcuts.ts, which the "Keyboard shortcuts" dialog is drawn from too.
    const key = shortcutFor(event.key, 'map')
    if (!grid) {
      // Before the map has loaded the map's keys still do nothing here, and are kept from the player's shortcuts.
      if (key) event.preventDefault()
      return
    }
    const { col, row } = cursorRef.current
    const jump = event.shiftKey ? BIG_STEP : 1
    let handled = true
    switch (key) {
      case 'map-west': moveByKey(col - jump, row, 'West'); break
      case 'map-east': moveByKey(col + jump, row, 'East'); break
      case 'map-north': moveByKey(col, row - jump, 'North'); break
      case 'map-south': moveByKey(col, row + jump, 'South'); break
      case 'edge-west': moveByKey(0, row, 'West'); break
      case 'edge-east': moveByKey(grid.cols - 1, row, 'East'); break
      case 'edge-north': moveByKey(col, 0, 'North'); break
      case 'edge-south': moveByKey(col, grid.rows - 1, 'South'); break
      case 'replay': moveTo(col, row); break
      case 'sweep': sweep(event.shiftKey ? 'column' : 'row'); break
      case 'lock': if (locked) unlock(); else lock(); break
      case 'stop': if (locked) unlock(); stopSound(); break
      default: handled = false
    }
    if (handled) {
      event.preventDefault()
      if (key !== 'stop') {
        wake()
        probe?.start()
      }
    }
  }, [grid, locked, lock, unlock, moveByKey, moveTo, sweep, stopSound, wake, probe])

  /** The cell under a pointer, from its place on the surface (which covers just the map area). */
  const cellFromPointer = useCallback((event: PointerEvent<HTMLElement>): Cursor | null => {
    if (!grid) return null
    const box = event.currentTarget.getBoundingClientRect()
    if (!box.width || !box.height) return null
    const x = Math.min(0.999999, Math.max(0, (event.clientX - box.left) / box.width))
    const y = Math.min(0.999999, Math.max(0, (event.clientY - box.top) / box.height))
    return { col: Math.floor(x * grid.cols), row: Math.floor(y * grid.rows) }
  }, [grid])

  const dragging = useRef(false)
  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    const at = cellFromPointer(event)
    if (!at) return
    dragging.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.currentTarget.focus()
    probe?.start()
    moveTo(at.col, at.row, false, 'pointer')
    wake()
  }, [cellFromPointer, moveTo, wake, probe])
  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    // A drag moves the cursor. With the continuous tone on, so does a mouse moving over the map: the tone follows it (once a press has started the sound).
    if (!dragging.current && !(probe && event.pointerType === 'mouse')) return
    const at = cellFromPointer(event)
    const now = cursorRef.current
    if (at && (at.col !== now.col || at.row !== now.row)) moveTo(at.col, at.row, false, 'pointer')
  }, [cellFromPointer, moveTo, probe])
  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!dragging.current) return
    dragging.current = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    probe?.leave()
    announceCell(cursorRef.current, 0)
  }, [announceCell, probe])
  /** The pointer left the map: the continuous tone stops. */
  const onPointerLeave = useCallback(() => {
    if (!dragging.current) probe?.leave()
  }, [probe])

  return {
    on, grid, error, cursor, sweeping, locked, area, image: frame.image, loading: on && !grid && !error,
    turnOn, turnOff, openAt, moveTo, sweep, stopSound, lock, unlock, playLockedAt, playAcrossDates, onKeyDown, onPointerDown, onPointerMove, onPointerUp,
    onPointerLeave, cellAt,
    /** SN09: the "Continuous tone" and "Slope cue" choices. */
    probeSettings,
  }
}
