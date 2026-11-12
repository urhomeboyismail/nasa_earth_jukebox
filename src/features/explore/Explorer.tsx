// The sound map (docs/PLAN.md §5.6, ticket T81): explore one date's map by ear with the keyboard, a finger or a mouse, and sweep
// along a row or column. `useExplorer` (useExplorer.ts) holds the state; `ExplorerSurface` is drawn over the image and `ExplorerPanel` sits below it.

import { useEffect, useId, useMemo, useRef } from 'react'
import { Button, Notice, Slider } from '../../components'
import type { Visualization } from '../../data'
import { describeCell } from '../../describe'
import { useDescriptionDetail } from '../../describe/detail'
import { ProbeSwitch } from './ProbeSwitch'
import type { ExplorerState } from './useExplorer'
import './explore.css'


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
        onPointerLeave={explorer.onPointerLeave}
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
        Shift with Enter plays the column from north to south. L locks the place you are on, so the date slider then plays that one place on each date; L or Escape unlocks. Escape also stops the sound.
      </p>
    </>
  )
}

/** Notices, and for touch and screen readers: two sliders that move the same cursor, and buttons to sweep. Shown while exploring. */
export function ExplorerPanel({ visualization, explorer }: { visualization: Visualization; explorer: ExplorerState }) {
  const { on, grid, cursor, loading, error } = explorer
  const [detail] = useDescriptionDetail()
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
          <div className="explorer__sliders">
            <Slider
              label="Column, west to east"
              min={0}
              max={grid.cols - 1}
              value={cursor.col}
              disabled={explorer.locked}
              onChange={col => explorer.moveTo(col, cursor.row, false)}
              describe={() => here}
            />
            <Slider
              label="Row, north to south"
              min={0}
              max={grid.rows - 1}
              value={cursor.row}
              disabled={explorer.locked}
              onChange={row => explorer.moveTo(cursor.col, row, false)}
              describe={() => here}
            />
          </div>
          <div className="explorer__buttons" role="group" aria-label="Sweep the map">
            <Button onClick={() => explorer.sweep('row')}>Sweep this row</Button>
            <Button onClick={() => explorer.sweep('column')}>Sweep this column</Button>
            <Button onClick={explorer.stopSound}>Stop</Button>
          </div>
          <div className="explorer__buttons" role="group" aria-label="Time travel">
            <Button pressed={explorer.locked} onClick={explorer.locked ? explorer.unlock : explorer.lock}>Lock this place</Button>
            <Button disabled={!explorer.locked} onClick={() => void explorer.playAcrossDates()}>Play this place across the dates</Button>
          </div>
        </>
      )}
      <ProbeSwitch settings={explorer.probeSettings} />
    </div>
  )
}
