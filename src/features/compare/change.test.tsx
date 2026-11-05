// The "change" style in Compare (ticket T115): the question, the sound of a date, the answer and the reveal. With no baseline, none of it shows.

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import ComparePage from '.'

const plain = fixture as Visualization
const withBaseline = {
  ...plain,
  baseline: { kind: 'climatology', label: 'the 1991 to 2020 average', noiseFloor: 0.2 },
  mapping: {
    ...plain.mapping,
    changeSteps: [{ id: 'below', range: [-Infinity, 0] }, { id: 'near-normal', range: [0, 1] }, { id: 'above', range: [1, Infinity] }],
    contourLevels: [{ value: 1 }],
  },
} as unknown as Visualization

const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => {}),
  playCategory: vi.fn(),
  playMissing: vi.fn(),
  playSequence: vi.fn(),
  stop: vi.fn(),
  setStyle: vi.fn(),
  setSpatial: vi.fn(),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))
const analyzeAll = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll }))

// Frame 0 is cold but ABOVE normal, frame 1 is mild and near normal, frame 2 is hot but BELOW normal: the category and the change disagree.
const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient']
const STEPS = ['above', 'near-normal', 'below', 'insufficient']
const analysis = (withChange: boolean) => plain.frames.map((frame, i) => ({
  frameId: frame.id, regionId: 'centre', sampled: 9, valid: i === 3 ? 0 : 9, category: CATEGORIES[i],
  ...(withChange && { changeStep: STEPS[i], ...(i < 3 && { medianChange: [1.5, 0.4, -1][i] }) }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  analyzeAll.mockImplementation(async (_f, _r, _c, _m, v?: unknown) => analysis(!!v))
})
afterEach(() => localStorage.clear())

async function renderReady(visualization: Visualization) {
  const user = userEvent.setup()
  const view = render(<ComparePage visualization={visualization} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play date A' })).toBeEnabled())
  return { user, ...view }
}

describe('Compare with no baseline (v1)', () => {
  it('has no change button, asks about warmer water, and plays a remembered "change" as "full"', async () => {
    localStorage.setItem('earth-jukebox:sound-style', 'change')
    const { user } = await renderReady(plain)
    expect(screen.queryByRole('button', { name: 'Change from normal' })).toBeNull()
    expect(engine.setStyle).toHaveBeenLastCalledWith('full')
    await user.click(screen.getByRole('button', { name: 'Play date A' }))
    expect(engine.playSequence).not.toHaveBeenCalled()
    expect(analyzeAll).toHaveBeenCalledWith(plain.frames, plain.regions[0], plain.colorScale, plain.mapping)
  })
})

describe('Compare with a baseline', () => {
  async function inChangeStyle() {
    const view = await renderReady(withBaseline)
    await view.user.click(screen.getByRole('button', { name: 'Change from normal' }))
    // Choose the listener's own dates: frame 0 (above normal) against frame 2 (below normal).
    await view.user.selectOptions(screen.getByLabelText('Comparison'), 'custom')
    return view
  }

  it('offers the change style as a button, off at first, and the usual question', async () => {
    await renderReady(withBaseline)
    expect(screen.getByRole('button', { name: 'Change from normal' })).toHaveAttribute('aria-pressed', 'false')
    expect(engine.setStyle).toHaveBeenLastCalledWith('full')
  })

  it('asks which date is further above its normal, in the change style', async () => {
    await inChangeStyle()
    expect(engine.setStyle).toHaveBeenLastCalledWith('change')
    expect(screen.getByText('Which date is further above its normal?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'A is further above' })).toBeInTheDocument()
  })

  it('plays the date as a change bed with its step, not as a category note', async () => {
    const { user } = await inChangeStyle()
    await user.click(screen.getByRole('button', { name: 'Play date A' }))
    expect(engine.playCategory).not.toHaveBeenCalled()
    expect(engine.playSequence).toHaveBeenCalledWith([{ category: 'cold', atMs: 0, changeStep: 'above', medianChange: 1.5 }], expect.any(Function), { tick: false })
  })

  it('plays the hiss for a date whose change could not be read', async () => {
    const { user } = await inChangeStyle()
    await user.selectOptions(screen.getByLabelText('Date A'), plain.frames[3].id)
    await user.click(screen.getByRole('button', { name: 'Play date A' }))
    expect(engine.playMissing).toHaveBeenCalled()
  })

  it('judges by change, even where the temperature says the opposite, and names the baseline in the reveal', async () => {
    const { user } = await inChangeStyle()
    await user.selectOptions(screen.getByLabelText('Date A'), plain.frames[0].id)
    await user.selectOptions(screen.getByLabelText('Date B'), plain.frames[2].id)
    await user.click(screen.getByRole('radio', { name: 'A is further above' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    const result = screen.getByRole('region', { name: 'Result' })
    expect(result).toHaveTextContent('Correct.')
    expect(result).toHaveTextContent('Date A is further above its normal.')
    expect(result).toHaveTextContent('was above')
    expect(result).toHaveTextContent('was below, measured against the 1991 to 2020 average.')
  })

  it('passes the axe check in the change style', async () => {
    const { container } = await inChangeStyle()
    await expectNoA11yViolations(container)
  })
})
