import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { ColorScale, Visualization } from '../data'
import { expectNoA11yViolations } from '../test/a11y'
import { colourAt } from './colourAt'
import { Legend } from './Legend'

const visualization = fixture as Visualization
// Blue at 0, yellow at 15, red at 30.
const scale = visualization.colorScale

const renderLegend = (overrides: Partial<Visualization> = {}) => {
  const v = { ...visualization, ...overrides }
  return render(<Legend colorScale={v.colorScale} mapping={v.mapping} variable={v.variable} />)
}

describe('colourAt', () => {
  it('gives the legend colour at each stop', () => {
    expect(colourAt(scale, 0)).toEqual([0, 0, 255])
    expect(colourAt(scale, 15)).toEqual([255, 255, 0])
    expect(colourAt(scale, 30)).toEqual([255, 0, 0])
  })

  it('blends between two stops in proportion to the value', () => {
    expect(colourAt(scale, 7.5)).toEqual([128, 128, 128])
    expect(colourAt(scale, 3)).toEqual([51, 51, 204])
    expect(colourAt(scale, 27)).toEqual([255, 51, 0])
  })

  it('holds the end colours beyond the legend', () => {
    expect(colourAt(scale, -10)).toEqual([0, 0, 255])
    expect(colourAt(scale, 99)).toEqual([255, 0, 0])
  })

  it('works when the stops are given out of order', () => {
    const shuffled: ColorScale = { ...scale, stops: [scale.stops[2], scale.stops[0], scale.stops[1]] }
    expect(colourAt(shuffled, 7.5)).toEqual([128, 128, 128])
  })
})

describe('Legend', () => {
  it('says in words how far the colours run, so it does not depend on seeing them', () => {
    renderLegend()
    expect(screen.getByText('Colours run from 0 °C (left) to 30 °C (right).')).toBeInTheDocument()
  })

  it('lists every category with its range, coolest first', () => {
    renderLegend()
    const items = within(screen.getByRole('list')).getAllByRole('listitem').map(item => item.textContent)
    expect(items).toEqual(['Cold: 0 to 6 °C', 'Cool: 6 to 12 °C', 'Mild: 12 to 18 °C', 'Warm: 18 to 24 °C', 'Hot: 24 to 30 °C'])
  })

  it('shows each category in the colour the legend gives its middle value', () => {
    const { container } = renderLegend()
    const swatches = [...container.querySelectorAll<HTMLElement>('.ui-legend__swatch')]
    expect(swatches).toHaveLength(5)
    expect(swatches[0].style.background).toBe('rgb(51, 51, 204)')
    expect(swatches[4].style.background).toBe('rgb(255, 51, 0)')
  })

  it('hides the colours from assistive technology, since the text says everything', () => {
    const { container } = renderLegend()
    const decorations = container.querySelectorAll('.ui-legend__bar, .ui-legend__swatch')
    expect(decorations.length).toBe(6)
    decorations.forEach(element => expect(element).toHaveAttribute('aria-hidden', 'true'))
  })

  it('draws a gradient bar from the legend stops, placed by value', () => {
    const { container } = renderLegend()
    const bar = container.querySelector<HTMLElement>('.ui-legend__bar')!
    expect(bar.style.background).toContain('linear-gradient')
    expect(bar.style.background).toContain('rgb(255, 255, 0) 50%')
  })

  it('leaves out the unit when there is none', () => {
    renderLegend({ variable: { name: 'Ice', unit: '' } })
    expect(screen.getByText('Colours run from 0 (left) to 30 (right).')).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent('Cold: 0 to 6')
  })

  it('copes with a legend that has one value, without dividing by zero', () => {
    const flat: ColorScale = { ...scale, stops: [{ value: 5, rgb: [10, 20, 30] }, { value: 5, rgb: [10, 20, 30] }] }
    const { container } = renderLegend({ colorScale: flat })
    expect(container.querySelector<HTMLElement>('.ui-legend__bar')!.style.background).toContain('rgb(10, 20, 30)')
    expect(screen.getByText(/Colours run from 5 °C/)).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderLegend()
    await expectNoA11yViolations(container)
  })
})
