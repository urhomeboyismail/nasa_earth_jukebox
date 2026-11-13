// The sound map (docs/PLAN.md §5.6, ticket T81): explore one date's map by ear with the keyboard, a finger or a mouse, and sweep
// along a row or column. `useExplorer` (useExplorer.ts) holds the state; `ExplorerSurface` is drawn over the image and `ExplorerPanel` sits below it.

import { useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react'
import { Button, ButtonGroup, Notice, Slider } from '../../components'
import type { Visualization } from '../../data'
import { describeCell } from '../../describe'
import { useDescriptionDetail } from '../../describe/detail'
import { Magnifier } from './Magnifier'
import { ProbeSwitch } from './ProbeSwitch'
import type { ExplorerState } from './useExplorer'
import type { Verbosity } from './whatsHere'
import './explore.css'

/** IX02: how many words the first "What's here?" gives. */
const VERBOSITY_OPTIONS: readonly { value: Verbosity; label: string }[] = [
  { value: 'brief', label: 'Brief' },
  { value: 'full', label: 'Full' },
]

// VIS1: three choices about how the map looks. They only change the view, never what is read or sounded. Kept on the device; when
// storage is blocked they still hold for the visit. Shared by the surface and the panel, which are separate components.
const MAGNIFIER_KEY = 'earth-jukebox:magnifier'
const OUTLINE_KEY = 'earth-jukebox:map-outline'
/** Only used when storage is blocked: the choice then holds for this visit. */
const visitChoices = new Map<string, boolean>()
const viewListeners = new Set<() => void>()

function readView(key: string): boolean {
  try { return localStorage.getItem(key) === 'on' } catch { return visitChoices.get(key) ?? false }
}

function writeView(key: string, on: boolean) {
  try { localStorage.setItem(key, on ? 'on' : 'off') } catch { visitChoices.set(key, on) }
  viewListeners.forEach(listener => listener())
}

function useViewChoice(key: string): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    listener => { viewListeners.add(listener); return () => { viewListeners.delete(listener) } },
    () => readView(key),
    () => false,
  )
  return [on, next => writeView(key, next)]
}

/** The element over the map area that takes the keys, touches and mouse. Draws the cursor. */
export function ExplorerSurface({ explorer }: { explorer: ExplorerState }) {
  const instructions = useId()
  const surface = useRef<HTMLDivElement>(null)
  const { on, area, grid, cursor } = explorer
  const [magnifier] = useViewChoice(MAGNIFIER_KEY)
  const [outline] = useViewChoice(OUTLINE_KEY)
  useEffect(() => { if (on) surface.current?.focus() }, [on])
  if (!on) return null

  return (
    <>
      <div
        ref={surface}
        className={outline ? 'explorer__surface explorer__surface--outline' : 'explorer__surface'}
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
        onPointerLeave={explorer.onPointerLeave}
        onContextMenu={explorer.onContextMenu}
      >
        {grid && (
          <>
            <div className="explorer__line explorer__line--across" aria-hidden="true" data-testid="crosshair-row" style={{ top: `${((cursor.row + 0.5) / grid.rows) * 100}%` }} />
            <div className="explorer__line explorer__line--down" aria-hidden="true" data-testid="crosshair-column" style={{ left: `${((cursor.col + 0.5) / grid.cols) * 100}%` }} />
          </>
        )}
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
        {grid && magnifier && explorer.image && <Magnifier image={explorer.image} cell={cursor} grid={grid} area={area} />}
      </div>
      <p id={instructions} className="explorer__instructions">{explorer.instructions}</p>
    </>
  )
}

/** Notices, and for touch and screen readers: two sliders that move the same cursor, and buttons to sweep. Shown while exploring. */
export function ExplorerPanel({ visualization, explorer }: { visualization: Visualization; explorer: ExplorerState }) {
  const { on, grid, cursor, loading, error } = explorer
  const [detail] = useDescriptionDetail()
  const [magnifier, setMagnifier] = useViewChoice(MAGNIFIER_KEY)
  const [outline, setOutline] = useViewChoice(OUTLINE_KEY)
  const here = useMemo(
    () => (grid ? describeCell(visualization, grid, cursor.col, cursor.row, { detail }) : ''),
    [grid, cursor.col, cursor.row, visualization, detail],
  )
  if (!on) return null

  return (
    <div className="explorer__panel">
      {loading && <Notice>Reading the map…</Notice>}
      {error && <Notice variant="error">The map could not be read. {error}</Notice>}
      {grid && (
        <>
          {/* IX02: the answer to "What's here?" stays here until the next one. It is not a live region: the announcer already says it. */}
          {explorer.whatsHere && <p className="explorer__here">{explorer.whatsHere}</p>}
          <div className="explorer__sliders">
            <Slider
              label="Column, west to east"
              min={0}
              max={grid.cols - 1}
              value={cursor.col}
              disabled={explorer.locked}
              onChange={col => explorer.moveTo(col, cursor.row, 'slider')}
              describe={() => here}
            />
            <Slider
              label="Row, north to south"
              min={0}
              max={grid.rows - 1}
              value={cursor.row}
              disabled={explorer.locked}
              onChange={row => explorer.moveTo(cursor.col, row, 'slider')}
              describe={() => here}
            />
          </div>
          <div className="explorer__buttons" role="group" aria-label="Sweep the map">
            <Button onClick={() => explorer.sweep('row')}>Sweep this row</Button>
            <Button onClick={() => explorer.sweep('column')}>Sweep this column</Button>
            <Button onClick={explorer.stopSound}>Stop</Button>
          </div>
          <div className="explorer__buttons" role="group" aria-label="See the map">
            <Button pressed={magnifier} onClick={() => setMagnifier(!magnifier)}>Magnifier</Button>
            <Button pressed={outline} onClick={() => setOutline(!outline)}>High-contrast outline</Button>
          </div>
          <div className="explorer__buttons" role="group" aria-label="Time travel">
            <Button pressed={explorer.locked} onClick={explorer.locked ? explorer.unlock : explorer.lock}>Lock this place</Button>
            <Button disabled={!explorer.locked} onClick={() => void explorer.playAcrossDates()}>Play this place across the dates</Button>
          </div>
          <ButtonGroup type="connected" legend="Words for What's here" options={VERBOSITY_OPTIONS} value={explorer.verbosity} onChange={explorer.setVerbosity} />
        </>
      )}
      <ProbeSwitch settings={explorer.probeSettings} />
    </div>
  )
}
