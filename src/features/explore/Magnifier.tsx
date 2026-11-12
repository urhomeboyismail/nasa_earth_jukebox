// A lens beside the sound-map cursor that shows the same frame three times larger (ticket VIS1). Decorative: it only changes the view,
// never what is read or sounded, and says nothing to a screen reader (the place is spoken or read with the panel's text).

import type { CSSProperties } from 'react'
import type { MapArea } from '../../data'

/** How many times larger than the map the lens shows the picture. */
const LENS_ZOOM = 3

/** The middle of a cell as a fraction (0 to 1) of the map area, along each side. */
function lensPosition(cell: { col: number; row: number }, grid: { cols: number; rows: number }): { x: number; y: number } {
  return { x: (cell.col + 0.5) / grid.cols, y: (cell.row + 0.5) / grid.rows }
}

type Props = {
  /** The frame's picture. */
  image: string
  cell: { col: number; row: number }
  grid: { cols: number; rows: number }
  area: MapArea
}

/** Sits inside the explorer surface, which is a size container, so `cqw` and `cqh` in the CSS mean the map's own width and height. */
export function Magnifier({ image, cell, grid, area }: Props) {
  const at = lensPosition(cell, grid)
  const width = area.x1 - area.x0, height = area.y1 - area.y0
  const style = {
    left: `${at.x * 100}%`,
    top: `${at.y * 100}%`,
    backgroundImage: `url("${image}")`,
    '--lens-zoom': LENS_ZOOM,
    '--lens-size-x': width,
    '--lens-size-y': height,
    '--lens-at-x': area.x0 / width + at.x,
    '--lens-at-y': area.y0 / height + at.y,
    '--lens-flip': at.x > 0.5 ? 1 : 0,
  } as CSSProperties
  return <div className="explorer__lens" aria-hidden="true" data-testid="magnifier" style={style} />
}
