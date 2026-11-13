import { useId } from 'react'
import { PATTERN_NAMES, patternFor, type PatternName } from './patterns'

// VIS2: six patterns that differ without colour. Stroke only, so they survive greyscale. Each is drawn twice: a dark halo and a
// line over it. Normally the halo is hidden; in high contrast the line is white and the halo outlines it (display.css).

function shapes(name: PatternName) {
  switch (name) {
    case 'lines-wide': return <path d="M0 0V14" />
    case 'lines-narrow': return <path d="M0 0V6" />
    case 'crosshatch': return <path d="M0 0V9M0 0H9" />
    case 'dots-small': return <circle cx="3" cy="3" r="1.1" />
    case 'dots-large': return <circle cx="7" cy="7" r="3" />
    case 'wavy': return <path d="M0 4Q3 0 6 4T12 4" />
  }
}

const SIZE: Record<PatternName, [number, number]> = {
  'lines-wide': [14, 14], 'lines-narrow': [6, 6], crosshatch: [9, 9], 'dots-small': [6, 6], 'dots-large': [14, 14], wavy: [12, 8],
}
const ROTATE: Partial<Record<PatternName, number>> = { 'lines-wide': 45, 'lines-narrow': 45, crosshatch: 45 }

/** The patterns an element can fill with, `url(#prefix-name)`. The prefix keeps ids unique when the page has more than one set. */
function PatternDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      {PATTERN_NAMES.map(name => (
        <pattern key={name} id={`${prefix}-${name}`} data-pattern={name} width={SIZE[name][0]} height={SIZE[name][1]} patternUnits="userSpaceOnUse"
          patternTransform={ROTATE[name] ? `rotate(${ROTATE[name]})` : undefined}>
          <g className="pattern__halo">{shapes(name)}</g>
          <g className="pattern__line">{shapes(name)}</g>
        </pattern>
      ))}
    </defs>
  )
}

const plain = (id: string) => id.replace(/:/g, '')

type LayerProps = {
  grid: { cols: number; rows: number; cells: readonly { category: string }[] }
  /** The ids of `mapping.categories`, coolest first. */
  categoryIds: readonly string[]
}

/** One rectangle per cell of the sound map, filled with its category's pattern. Decoration only: the words are already said by the explorer. */
export function PatternLayer({ grid, categoryIds }: LayerProps) {
  const prefix = `pattern-${plain(useId())}`
  return (
    <svg className="pattern-layer" aria-hidden="true" focusable="false" width="100%" height="100%" data-testid="pattern-layer">
      <PatternDefs prefix={prefix} />
      {grid.cells.map((cell, index) => (
        <rect key={index} x={`${((index % grid.cols) / grid.cols) * 100}%`} y={`${(Math.floor(index / grid.cols) / grid.rows) * 100}%`}
          width={`${100 / grid.cols}%`} height={`${100 / grid.rows}%`} fill={`url(#${prefix}-${patternFor(cell.category, categoryIds)})`} />
      ))}
    </svg>
  )
}

/** The pattern of one category, as a small square beside its colour in the legend. */
export function PatternSwatch({ category, categoryIds }: { category: string; categoryIds: readonly string[] }) {
  const prefix = `pattern-${plain(useId())}`
  const name = patternFor(category, categoryIds)
  return (
    <svg className="pattern-swatch" aria-hidden="true" focusable="false" width="100%" height="100%" data-pattern={name}>
      <PatternDefs prefix={prefix} />
      <rect width="100%" height="100%" fill={`url(#${prefix}-${name})`} />
    </svg>
  )
}
