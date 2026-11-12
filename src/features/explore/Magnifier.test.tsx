import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import css from '../../index.css?raw'
import { Magnifier } from './Magnifier'

// Every style and source file in src/, as text (Vite reads them; the app's TypeScript has no Node types).
const sources = import.meta.glob<string>('/src/**/*.{css,ts,tsx}', { query: '?raw', import: 'default', eager: true })

const grid = { cols: 24, rows: 12 }
const area = { x0: 0.1, y0: 0.2, x1: 0.9, y1: 0.8 }
const lens = () => screen.getByTestId('magnifier')
const vars = (el: HTMLElement) => ({ x: el.style.getPropertyValue('--lens-at-x'), y: el.style.getPropertyValue('--lens-at-y') })

describe('Magnifier', () => {
  it('is decorative: hidden from screen readers, with no name and no role', async () => {
    const { container } = render(<Magnifier image="a.png" cell={{ col: 3, row: 4 }} grid={grid} area={area} />)
    expect(lens()).toHaveAttribute('aria-hidden', 'true')
    expect(lens()).not.toHaveAttribute('role')
    expect(lens().textContent).toBe('')
    await expectNoA11yViolations(container)
  })

  it('shows the frame image, and its position follows the cursor cell', () => {
    const { rerender } = render(<Magnifier image="a.png" cell={{ col: 0, row: 0 }} grid={grid} area={area} />)
    expect(lens().style.backgroundImage).toContain('a.png')
    const first = vars(lens())
    rerender(<Magnifier image="a.png" cell={{ col: 20, row: 9 }} grid={grid} area={area} />)
    const second = vars(lens())
    expect(Number(second.x)).toBeGreaterThan(Number(first.x))
    expect(Number(second.y)).toBeGreaterThan(Number(first.y))
  })

  it('centres on the middle of the cell, counted from the whole picture', () => {
    render(<Magnifier image="a.png" cell={{ col: 12, row: 6 }} grid={grid} area={{ x0: 0, y0: 0, x1: 1, y1: 1 }} />)
    expect(Number(vars(lens()).x)).toBeCloseTo(12.5 / 24, 6)
    expect(Number(vars(lens()).y)).toBeCloseTo(6.5 / 12, 6)
  })

  it('flips to the left of the cursor once it is past the middle', () => {
    const { rerender } = render(<Magnifier image="a.png" cell={{ col: 2, row: 0 }} grid={grid} area={area} />)
    expect(lens().style.getPropertyValue('--lens-flip')).toBe('0')
    rerender(<Magnifier image="a.png" cell={{ col: 22, row: 0 }} grid={grid} area={area} />)
    expect(lens().style.getPropertyValue('--lens-flip')).toBe('1')
  })
})

describe('forced colours (VIS1)', () => {
  it('has a forced-colors block that draws the map controls in CanvasText', () => {
    const block = css.slice(css.indexOf('@media (forced-colors: active)'))
    expect(block).toContain('@media (forced-colors: active)')
    for (const selector of ['.explorer__cursor', '.explorer__surface:focus-visible', '.ui-slider', '.ui-legend__swatch', '.player__frame svg rect']) {
      expect(block).toContain(selector)
    }
    expect(block).toContain('CanvasText')
  })

  it('never turns forced-color-adjust off anywhere in src/', () => {
    const found = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, text]) => /forced-color-adjust\s*:\s*none/.test(text))
      .map(([path]) => path)
    expect(Object.keys(sources).length).toBeGreaterThan(50)
    expect(found).toEqual([])
  })
})
