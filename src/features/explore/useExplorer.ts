// The sound map's state (docs/PLAN.md §5.6, ticket T81): the cursor, the keys, touch and mouse, and the sweep. Kept apart from the components in
// Explorer.tsx so that file only exports components (fast refresh).

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { analyzeGrid, type FrameGrid } from '../../analysis'
import type { SequenceStep, SoundEngine } from '../../audio'
import { elevationForPoint, panForPoint } from '../../audio/pan'
import { useAnnounce } from '../../components'
import type { Frame, MapArea, Visualization } from '../../data'
import { describeCell, describeSweep } from '../../describe'
import { useDescriptionDetail } from '../../describe/detail'
import { vibrateForDate } from '../player/vibration'

/** A moved cursor plays at most this often; the latest cell wins. */
const PLAY_EVERY_MS = 120
/** The announcement waits for the cursor to rest, so a screen reader is not talking over the sounds. */
const ANNOUNCE_AFTER_MS = 400
/** One cell of a sweep per step. */
const SWEEP_STEP_MS = 250
const CELL_NOTE_MS = 300
const BIG_STEP = 4
/** Keys the sound map owns. Before the map has loaded they still do nothing here, and are kept from the player's shortcuts. */
const MAP_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', ' ', 'Enter', 'Escape'])
const WHOLE_MAP: MapArea = { x0: 0, y0: 0, x1: 1, y1: 1 }

type Cursor = { col: number; row: number }
type Edge = 'West' | 'East' | 'North' | 'South'
type Line = 'row' | 'column'

type MapRead = { frame: Frame; colorScale: Visualization['colorScale']; mapping: Visualization['mapping']; mapArea: MapArea | undefined; grid: FrameGrid | null; error: string }

type Options = {
  visualization: Visualization
  frame: Frame
  engine: SoundEngine | null
  /** Buzz for each cell when the listener has vibration on. */
  vibrate: boolean
}

export type ExplorerState = ReturnType<typeof useExplorer>

export function useExplorer({ visualization, frame, engine, vibrate }: Options) {
  const { colorScale, mapping } = visualization
  const area = visualization.mapArea ?? WHOLE_MAP
  const announce = useAnnounce()
  const [detail] = useDescriptionDetail()

  const [on, setOn] = useState(false)
  // The map read for one date. It counts only while it matches the date and settings on screen, so a new date shows "loading" at once.
  const [read, setRead] = useState<MapRead | null>(null)
  const current = on && read && read.frame === frame && read.colorScale === colorScale && read.mapping === mapping && read.mapArea === visualization.mapArea ? read : null
  const grid = current?.grid ?? null
  const error = current?.error ?? ''
  const [cursor, setCursor] = useState<Cursor>({ col: 0, row: 0 })
  const [sweeping, setSweeping] = useState(false)

  // Timers and counters that must not cause a render.
  const sweepId = useRef(0)
  const announceTimer = useRef<number | undefined>(undefined)
  const playTimer = useRef<number | undefined>(undefined)
  const lastPlayed = useRef(-Infinity)
  const sweepEnd = useRef<number | undefined>(undefined)
  const placed = useRef(false)
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
    window.clearTimeout(sweepEnd.current)
    setSweeping(false)
  }, [])

  // Read the map of the date on screen. A new date reloads it; the cursor stays where it was.
  useEffect(() => {
    if (!on) return
    let cancelled = false
    const { mapArea } = visualization
    analyzeGrid(frame, colorScale, mapping, mapArea)
      .then(done => {
        if (cancelled) return
        setRead({ frame, colorScale, mapping, mapArea, grid: done, error: '' })
        // The first read puts the cursor in the middle; a later date keeps it where it was.
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
      stopSweep()
      clearTimers()
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
    const say = () => announce(describeCell(visualization, grid, at.col, at.row, { detail }))
    if (delay <= 0) say()
    else announceTimer.current = window.setTimeout(say, delay)
  }, [grid, visualization, announce, detail])

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

  /** Moves the cursor and plays the cell. `speak` is false for the sliders, which are announced by the screen reader itself. */
  const moveTo = useCallback((col: number, row: number, speak = true) => {
    if (!grid) return
    const next = { col: Math.min(grid.cols - 1, Math.max(0, col)), row: Math.min(grid.rows - 1, Math.max(0, row)) }
    stopSweep()
    place(next)
    soundCell(next)
    if (speak) announceCell(next, ANNOUNCE_AFTER_MS)
  }, [grid, stopSweep, place, soundCell, announceCell])

  /** A key that pushes against the edge of the map: no sound, and the edge is named once the keys rest, so a held key is not heard as a stall. */
  const hitEdge = useCallback((edge: Edge) => {
    stopSweep()
    window.clearTimeout(announceTimer.current)
    announceTimer.current = window.setTimeout(() => announce(`${edge} edge.`), ANNOUNCE_AFTER_MS)
  }, [stopSweep, announce])

  /** A move by key. Plays and announces the new cell like `moveTo`; if the cursor cannot move, it says which edge instead. */
  const moveByKey = useCallback((col: number, row: number, edge: Edge) => {
    if (!grid) return
    const at = cursorRef.current
    const target = { col: Math.min(grid.cols - 1, Math.max(0, col)), row: Math.min(grid.rows - 1, Math.max(0, row)) }
    if (target.col === at.col && target.row === at.row) hitEdge(edge)
    else moveTo(target.col, target.row)
  }, [grid, moveTo, hitEdge])

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
          announce(describeSweep(visualization, grid, { kind, index: kind === 'row' ? at.row : at.col }, { detail }))
        }, SWEEP_STEP_MS)
      }
    }, { tick: false })
  }, [engine, grid, centreX, elevationAt, stopSweep, place, announce, visualization, detail])

  /** Stops the sound of a sweep or cell, keeping the cursor where it is. */
  const stopSound = useCallback(() => {
    stopSweep()
    clearTimers()
    engine?.stop()
  }, [stopSweep, clearTimers, engine])

  const turnOn = useCallback(() => {
    // The first press has to start the audio, so it is asked for here, in the click.
    void engine?.unlock()
    setOn(true)
  }, [engine])

  const turnOff = useCallback(() => {
    setOn(false)
    setRead(null)
    placed.current = false
    stopSound()
  }, [stopSound])

  /** The keyboard. Every key handled here is also stopped from reaching the player's own shortcuts. */
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (!grid) {
      if (MAP_KEYS.has(event.key)) event.preventDefault()
      return
    }
    const { col, row } = cursorRef.current
    const jump = event.shiftKey ? BIG_STEP : 1
    let handled = true
    switch (event.key) {
      case 'ArrowLeft': moveByKey(col - jump, row, 'West'); break
      case 'ArrowRight': moveByKey(col + jump, row, 'East'); break
      case 'ArrowUp': moveByKey(col, row - jump, 'North'); break
      case 'ArrowDown': moveByKey(col, row + jump, 'South'); break
      case 'Home': moveByKey(0, row, 'West'); break
      case 'End': moveByKey(grid.cols - 1, row, 'East'); break
      case 'PageUp': moveByKey(col, 0, 'North'); break
      case 'PageDown': moveByKey(col, grid.rows - 1, 'South'); break
      case ' ': moveTo(col, row); break
      case 'Enter': sweep(event.shiftKey ? 'column' : 'row'); break
      case 'Escape': stopSound(); break
      default: handled = false
    }
    if (handled) event.preventDefault()
  }, [grid, moveByKey, moveTo, sweep, stopSound])

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
    moveTo(at.col, at.row, false)
  }, [cellFromPointer, moveTo])
  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!dragging.current) return
    const at = cellFromPointer(event)
    const now = cursorRef.current
    if (at && (at.col !== now.col || at.row !== now.row)) moveTo(at.col, at.row, false)
  }, [cellFromPointer, moveTo])
  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!dragging.current) return
    dragging.current = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    announceCell(cursorRef.current, 0)
  }, [announceCell])

  return {
    on, grid, error, cursor, sweeping, area, loading: on && !grid && !error,
    turnOn, turnOff, moveTo, sweep, stopSound, onKeyDown, onPointerDown, onPointerMove, onPointerUp,
    cellAt,
  }
}
