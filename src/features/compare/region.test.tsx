// F48: Compare plays each ready-made comparison in its own region and the listener's own dates in the region they chose; the listening test keeps the first region.

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { AnnouncerProvider } from '../../components'
import type { Region, Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import ComparePage from '.'

const base = fixture as Visualization
const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const
const north: Region = { id: 'north', name: 'Northern ocean', description: 'A strip along the top.', points: [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }] }
const inNorth = { id: 'july-vs-december', regionId: 'north', frameA: '2024-07-15', frameB: '2024-12-15', question: 'Which is warmer in the north, July or December?', answer: 'b' as const, explanation: 'December is red.' }

const twoRegions: Visualization = { ...base, regions: [...base.regions, north], comparisons: [base.comparisons[0], inNorth] }

const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => {}),
  playCategory: vi.fn(),
  playMissing: vi.fn(),
  stop: vi.fn(),
  setStyle: vi.fn(),
  setSpatial: vi.fn(),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))
const analyzeAll = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll }))

const lastRegionAnalysed = () => analyzeAll.mock.calls.at(-1)?.[1]?.id

beforeEach(() => {
  vi.clearAllMocks()
  window.location.hash = '#compare'
  // Like the real analysis, each result says which region it was read from.
  analyzeAll.mockImplementation(async (_frames: unknown, region: Region) =>
    base.frames.map((frame, i) => ({ frameId: frame.id, regionId: region.id, sampled: 9, valid: 9, category: CATEGORIES[i] })))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'sess1' }), { status: 201 })))
})
afterEach(() => {
  window.location.hash = ''
  vi.unstubAllGlobals()
})

async function renderCompare(visualization: Visualization) {
  const user = userEvent.setup()
  const view = render(<ComparePage visualization={visualization} />, { wrapper: AnnouncerProvider })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play date A' })).toBeEnabled())
  return { user, ...view }
}

describe('Compare: regions', () => {
  it('shows no region choice and no region name for a data set with one region', async () => {
    await renderCompare(base)
    expect(screen.queryByRole('combobox', { name: 'Region' })).toBeNull()
    expect(screen.queryByText(/^Region:/)).toBeNull()
  })

  it('plays a ready-made comparison in its own region, and names it', async () => {
    const { user } = await renderCompare(twoRegions)
    expect(lastRegionAnalysed()).toBe('centre')
    expect(screen.getByText('Region: Central ocean')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Comparison' }), 'july-vs-december')
    await waitFor(() => expect(lastRegionAnalysed()).toBe('north'))
    expect(screen.getByText('Region: Northern ocean')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play date A' })).toBeEnabled())
    // A ready-made comparison has no region choice: it has its own.
    expect(screen.queryByRole('combobox', { name: 'Region' })).toBeNull()
  })

  it('keeps the sound off until the region now in use has been read', async () => {
    const { user } = await renderCompare(twoRegions)
    let finish!: (value: unknown) => void
    analyzeAll.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Comparison' }), 'july-vs-december')
    expect(screen.getByRole('button', { name: 'Play date A' })).toBeDisabled()
    finish(base.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'north', sampled: 9, valid: 9, category: CATEGORIES[i] })))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play date A' })).toBeEnabled())
  })

  it('uses the chosen region for the listener\'s own two dates, and puts it in the address', async () => {
    const { user } = await renderCompare(twoRegions)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Comparison' }), 'custom')
    const picker = screen.getByRole('combobox', { name: 'Region' })
    expect(within(picker).getAllByRole('option').map(o => o.textContent)).toEqual(['Central ocean', 'Northern ocean'])
    expect(lastRegionAnalysed()).toBe('centre')

    await user.selectOptions(picker, 'north')
    await waitFor(() => expect(lastRegionAnalysed()).toBe('north'))
    expect(window.location.hash).toBe('#compare?region=north')
    expect(screen.getByText('Region: Northern ocean')).toBeInTheDocument()
    expect(engine.playCategory).not.toHaveBeenCalled()
  })

  it('has no accessibility violations with the region choice shown', async () => {
    const { user, container } = await renderCompare(twoRegions)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Comparison' }), 'custom')
    await expectNoA11yViolations(container)
  })
})

describe('Listening test: the first region', () => {
  const toConsent = (visualization: Visualization) => render(<ComparePage visualization={visualization} testMode />)

  it('lists only the comparisons in the first region, and says how many', async () => {
    toConsent(twoRegions)
    expect(screen.getByText('There is 1 pair to listen to, all in Central ocean.')).toBeInTheDocument()
    expect(lastRegionAnalysed()).toBe('centre')
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox', { name: /I agree to take part/ }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('radio', { name: 'I am blind or have low vision' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Start the test' }))
    expect(await screen.findByRole('heading', { name: 'Question 1 of 1' })).toBeInTheDocument()
    expect(screen.queryByText(inNorth.question)).toBeNull()
  })

  it('counts every pair when all of them are in the first region', () => {
    toConsent({ ...twoRegions, comparisons: [base.comparisons[0], { ...inNorth, regionId: 'centre' }] })
    expect(screen.getByText('There are 2 pairs to listen to, all in Central ocean.')).toBeInTheDocument()
  })

  it('says so, and does not start, when no comparison is in the first region', () => {
    toConsent({ ...twoRegions, comparisons: [inNorth] })
    expect(screen.getByText(/no comparisons for the listening test in Central ocean/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
  })
})
