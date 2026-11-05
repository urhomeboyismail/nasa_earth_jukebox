// The sound map (docs/PLAN.md §5.6, ticket T81): explore one date's map by ear with the keyboard, a finger or a mouse, and sweep
// along a row or column. `useExplorer` holds the state; `ExplorerSurface` is drawn over the image and `ExplorerPanel` sits below it.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { analyzeGrid, type FrameGrid } from '../../analysis'
import type { SequenceStep, SoundEngine } from '../../audio'
import { panForPoint } from '../../audio/pan'
import { Button, Notice, Slider, useAnnounce } from '../../components'
import type { Frame, MapArea, Visualization } from '../../data'
import { describeCell, describeSweep } from '../../describe'
import { vibrateForDate } from '../player/vibration'
import './explore.css'

/** A moved cursor plays at most this often; the latest cell wins. */
const PLAY_EVERY_MS = 120
/** The announcement waits for the cursor to rest, so a screen reader is not talking over the sounds. */
const ANNOUNCE_AFTER_MS = 400
/** One cell of a sweep per step. */
const SWEEP_STEP_MS = 250
const CELL_NOTE_MS = 300
const BIG_STEP = 4
const WHOLE_MAP: MapArea = { x0: 0, y0: 0, x1: 1, y1: 1 }

type Cursor = { col: number; row: number }
type Line = 'row' | 'column'

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

  const [on, setOn] = useState(false)
  const [grid, setGrid] = useState<FrameGrid | null>(null)
  const [error, setError] = useState('')
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

  // Read the map of the date on screen. A new date reloads it; the cursor stays where it was.
  useEffect(() => {
    if (!on) return
    let cancelled = false
    setGrid(null)
    setError('')
    analyzeGrid(frame, colorScale, mapping, visualization.mapArea)
      .then(done => {
        if (cancelled) return
        setGrid(done)
        // The first read puts the cursor in the middle; a later date keeps it where it was.
        const now = cursorRef.current
        if (!(placed.current && now.col < done.cols && now.row < done.rows)) {
          place({ col: Math.floor(done.cols / 2), row: Math.floor(done.rows / 2) })
        }
        placed.current = true
      })
      .catch((failure: unknown) => { if (!cancelled) setError(failure instanceof Error ? failure.message : String(failure)) })
    return () => {
      cancelled = true
      sweepId.current++
      setSweeping(false)
      clearTimers()
    }
  }, [on, frame, colorScale, mapping, visualization.mapArea, clearTimers, place])

  useEffect(() => clearTimers, [clearTimers])

  const cellAt = useCallback((col: number, row: number) => grid?.cells[row * grid.cols + col], [grid])
  /** The middle of a column as a fraction of the whole image (not just of the map), so the pan matches the picture. */
  const centreX = useCallback((col: number) => grid ? area.x0 + ((col + 0.5) / grid.cols) * (area.x1 - area.x0) : 0.5, [grid, area])

  const announceCell = useCallback((at: Cursor, delay: number) => {
    window.clearTimeout(announceTimer.current)
    if (!grid) return
    const say = () => announce(describeCell(visualization, grid, at.col, at.row))
    if (delay <= 0) say()
    else announceTimer.current = window.setTimeout(say, delay)
  }, [grid, visualization, announce])

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
      else engine.playCategory(cell.category, { pan: panForPoint(centreX(at.col)), durationMs: CELL_NOTE_MS })
      if (vibrate) vibrateForDate(cell.category, mapping)
    }
    const wait = PLAY_EVERY_MS - (Date.now() - lastPlayed.current)
    if (wait <= 0) play()
    else playTimer.current = window.setTimeout(play, wait)
  }, [engine, grid, centreX, vibrate, mapping])

  const stopSweep = useCallback(() => {
    sweepId.current++
    window.clearTimeout(sweepEnd.current)
    setSweeping(false)
  }, [])

  /** Moves the cursor and plays the cell. `speak` is false for the sliders, which are announced by the screen reader itself. */
  const moveTo = useCallback((col: number, row: number, speak = true) => {
    if (!grid) return
    const next = { col: Math.min(grid.cols - 1, Math.max(0, col)), row: Math.min(grid.rows - 1, Math.max(0, row)) }
    stopSweep()
    place(next)
    soundCell(next)
    if (speak) announceCell(next, ANNOUNCE_AFTER_MS)
  }, [grid, stopSweep, place, soundCell, announceCell])

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
    }))
    setSweeping(true)
    engine.playSequence(steps, k => {
      if (mine !== sweepId.current) return
      place(cells[k])
      if (k === steps.length - 1) {
        sweepEnd.current = window.setTimeout(() => {
          if (mine !== sweepId.current) return
          setSweeping(false)
          announce(describeSweep(visualization, grid, { kind, index: kind === 'row' ? at.row : at.col }))
        }, SWEEP_STEP_MS)
      }
    }, { tick: false })
  }, [engine, grid, centreX, stopSweep, place, announce, visualization])

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
    setGrid(null)
    placed.current = false
    stopSound()
  }, [stopSound])

  /** The keyboard. Every key handled here is also stopped from reaching the player's own shortcuts. */
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || !grid) return
    const { col, row } = cursorRef.current
    const jump = event.shiftKey ? BIG_STEP : 1
    let handled = true
    switch (event.key) {
      case 'ArrowLeft': moveTo(col - jump, row); break
      case 'ArrowRight': moveTo(col + jump, row); break
      case 'ArrowUp': moveTo(col, row - jump); break
      case 'ArrowDown': moveTo(col, row + jump); break
      case 'Home': moveTo(0, row); break
      case 'End': moveTo(grid.cols - 1, row); break
      case 'PageUp': moveTo(col, 0); break
      case 'PageDown': moveTo(col, grid.rows - 1); break
      case ' ': moveTo(col, row); break
      case 'Enter': sweep(event.shiftKey ? 'column' : 'row'); break
      case 'Escape': stopSound(); break
      default: handled = false
    }
    if (handled) event.preventDefault()
  }, [grid, moveTo, sweep, stopSound])

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

/** The element over the map area that takes the keys, touches and mouse. Draws the cursor. */
export function ExplorerSurface({ explorer }: { explorer: ExplorerState }) {
  const instructions = useId()
  const surface = useRef<HTMLDivElement>(null)
  const { on, area, grid, cursor } = explorer
  useEffect(() => { if (on) surface.current?.focus() }, [on])
  if (!on) return null

  return (
    <>
      <div
        ref={surface}
        className="explorer__surface"
        style={{ left: `${area.x0 * 100}%`, top: `${area.y0 * 100}%`, width: `${(area.x1 - area.x0) * 100}%`, height: `${(area.y1 - area.y0) * 100}%` }}
        tabIndex={0}
        role="application"
        aria-roledescription="sound map"
        aria-label="Explore the map by sound"
        aria-describedby={instructions}
        onKeyDown={explorer.onKeyDown}
        onPointerDown={explorer.onPointerDown}
        onPointerMove={explorer.onPointerMove}
        onPointerUp={explorer.onPointerUp}
        onPointerCancel={explorer.onPointerUp}
      >
        {grid && (
          <div
            className="explorer__cursor"
            aria-hidden="true"
            style={{
              left: `${(cursor.col / grid.cols) * 100}%`,
              top: `${(cursor.row / grid.rows) * 100}%`,
              width: `${100 / grid.cols}%`,
              height: `${100 / grid.rows}%`,
            }}
          />
        )}
      </div>
      <p id={instructions} className="explorer__instructions">
        Arrow keys move over the map and play each place; Shift with an arrow moves four places. Home and End go to the west and east
        edges, Page Up and Page Down to the north and south. Space plays the place again. Enter plays the row from west to east, and
        Shift with Enter plays the column from north to south. Escape stops the sound.
      </p>
    </>
  )
}

/** Notices, and for touch and screen readers: two sliders that move the same cursor, and buttons to sweep. Shown while exploring. */
export function ExplorerPanel({ visualization, explorer }: { visualization: Visualization; explorer: ExplorerState }) {
  const { on, grid, cursor, loading, error } = explorer
  const here = useMemo(
    () => (grid ? describeCell(visualization, grid, cursor.col, cursor.row) : ''),
    [grid, cursor.col, cursor.row, visualization],
  )
  if (!on) return null

  return (
    <div className="explorer__panel">
      {loading && <Notice>Reading the map…</Notice>}
      {error && <Notice variant="error">The map could not be read. {error}</Notice>}
      {grid && (
        <>
          <div className="explorer__sliders">
            <Slider
              label="Column, west to east"
              min={0}
              max={grid.cols - 1}
              value={cursor.col}
              onChange={col => explorer.moveTo(col, cursor.row, false)}
              describe={() => here}
            />
            <Slider
              label="Row, north to south"
              min={0}
              max={grid.rows - 1}
              value={cursor.row}
              onChange={row => explorer.moveTo(cursor.col, row, false)}
              describe={() => here}
            />
          </div>
          <div className="explorer__buttons" role="group" aria-label="Sweep the map">
            <Button onClick={() => explorer.sweep('row')}>Sweep this row</Button>
            <Button onClick={() => explorer.sweep('column')}>Sweep this column</Button>
            <Button onClick={explorer.stopSound}>Stop</Button>
          </div>
        </>
      )}
    </div>
  )
}
