import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { ColorScale, Visualization } from '../data'
import { DEFAULT_FLAGS } from '../display/flags'
import { DisplaySettingsContext } from '../display/useDisplaySettings'
import { expectNoA11yViolations } from '../test/a11y'
import { AnnouncerProvider } from './Announcer'
import { colourAt } from './colourAt'
import { Legend } from './Legend'

// JB07: the legend's ensemble and probe are recording stand-ins, so what it asks for can be checked and nothing sounds.
const ensemble = vi.hoisted(() => ({ status: vi.fn(() => 'off'), start: vi.fn(async () => {}) }))
const probe = vi.hoisted(() => ({ setMap: vi.fn(), point: vi.fn(), key: vi.fn(), leave: vi.fn(), start: vi.fn(), dispose: vi.fn() }))
vi.mock('../audio/ensemble/useEnsemble', () => ({ useEnsemble: () => ({ ensemble, status: 'off', start: ensemble.start }) }))
vi.mock('../features/explore/probeAudio', () => ({ createProbeAudio: () => probe }))

beforeEach(() => {
  Object.values(probe).forEach(fn => fn.mockClear())
  ensemble.status.mockReset()
  ensemble.status.mockReturnValue('off')
})

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

describe('Legend with colour-vision patterns (VIS2)', () => {
  const withPatterns = (on: boolean) => render(
    <DisplaySettingsContext.Provider value={{ flags: { ...DEFAULT_FLAGS, patterns: on }, setDisplay: () => {}, reset: () => {} }}>
      <Legend colorScale={visualization.colorScale} mapping={visualization.mapping} variable={visualization.variable} />
    </DisplaySettingsContext.Provider>,
  )

  it('shows no pattern while the setting is off', () => {
    const { container } = withPatterns(false)
    expect(container.querySelector('.pattern-swatch')).toBeNull()
  })

  it('shows a pattern swatch for each category, and one for missing data, with the words kept', async () => {
    const { container } = withPatterns(true)
    const swatches = [...container.querySelectorAll('.pattern-swatch')]
    expect(swatches).toHaveLength(visualization.mapping.categories.length + 1)
    expect(new Set(swatches.map(swatch => swatch.getAttribute('data-pattern'))).size).toBe(swatches.length)
    expect(screen.getByText('Not enough data')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })
})

describe('Legend: playable (JB07)', () => {
  const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''
  const renderPlayable = () => render(
    <AnnouncerProvider><Legend colorScale={visualization.colorScale} mapping={visualization.mapping} variable={visualization.variable} /></AnnouncerProvider>,
  )
  const stop = (name: string) => screen.getByRole('listitem', { name: new RegExp(`^${name}:`) })

  it('is reached by Tab at the first category, and the arrow keys move between categories', async () => {
    const user = userEvent.setup()
    renderPlayable()
    await user.tab()
    expect(screen.getAllByRole('listitem')[0]).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getAllByRole('listitem')[1]).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowLeft}{ArrowUp}')
    expect(screen.getAllByRole('listitem')[0]).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getAllByRole('listitem')[4]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getAllByRole('listitem')[0]).toHaveFocus()
  })

  it('sounds the focused category at the middle of its range, starts the sound from the key press, and says it once', async () => {
    const user = userEvent.setup()
    renderPlayable()
    await user.tab()
    expect(probe.start).toHaveBeenCalled()
    expect(probe.setMap).toHaveBeenLastCalledWith(expect.objectContaining({ grid: expect.objectContaining({ cells: [{ value: 3, category: 'cold' }] }) }))
    expect(probe.point).toHaveBeenCalledWith(0, 0)
    expect(liveText()).toBe('Cold: 0 to 6 °C')
  })

  it('says whether the pitch is higher or lower than the last category played', async () => {
    const user = userEvent.setup()
    renderPlayable()
    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(probe.setMap).toHaveBeenLastCalledWith(expect.objectContaining({ grid: expect.objectContaining({ cells: [{ value: 9, category: 'cool' }] }) }))
    // Messages sent while sound plays are rate-limited to one per 1.5 s, newest first (announceRate.ts).
    await waitFor(() => expect(liveText()).toContain('Cool: 6 to 12 °C, higher pitch'), { timeout: 3000 })
    await user.keyboard('{ArrowLeft}')
    await waitFor(() => expect(liveText()).toContain('Cold: 0 to 6 °C, lower pitch'), { timeout: 3000 })
  })

  it('stops the tone on blur', async () => {
    const user = userEvent.setup()
    renderPlayable()
    await user.tab()
    probe.leave.mockClear()
    await user.tab()
    expect(probe.leave).toHaveBeenCalled()
  })

  it('plays nothing on hover before a click or key press has started the sound', async () => {
    const user = userEvent.setup()
    renderPlayable()
    await user.hover(stop('Warm'))
    expect(probe.point).not.toHaveBeenCalled()
    expect(liveText()).toBe('')
  })

  it('starts the sound on a click and sounds the category it was on', async () => {
    const user = userEvent.setup()
    renderPlayable()
    await user.click(stop('Warm'))
    expect(probe.start).toHaveBeenCalled()
    expect(probe.setMap).toHaveBeenLastCalledWith(expect.objectContaining({ grid: expect.objectContaining({ cells: [{ value: 21, category: 'warm' }] }) }))
  })

  it('sounds a category on hover once the sound is on, and stops when the pointer leaves', async () => {
    const user = userEvent.setup()
    ensemble.status.mockReturnValue('on')
    renderPlayable()
    await user.hover(stop('Hot'))
    expect(probe.setMap).toHaveBeenLastCalledWith(expect.objectContaining({ grid: expect.objectContaining({ cells: [{ value: 27, category: 'hot' }] }) }))
    await user.unhover(stop('Hot'))
    expect(probe.leave).toHaveBeenCalled()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderPlayable()
    await expectNoA11yViolations(container)
  })
})
