// The "change" sound style in Listen (ticket T115): the sound control, the change steps on the steps played, and "Trace the warm edge".
// A data set with no baseline must be exactly as it was, so most of this checks what does NOT happen there.

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Contour, Score } from '../../analysis'
import type { Visualization } from '../../data'
import { dispatch } from '../../interaction/registry'
import { expectNoA11yViolations } from '../../test/a11y'
import { subscribeContext, type ContextUpdate } from '../../assistant/context'
import PlayerPage from '.'
import { AnnouncerProvider } from '../../components'

const plain = fixture as Visualization
const changeSteps = [
  { id: 'below', range: [-Infinity, -0.5] as [number, number] },
  { id: 'near-normal', range: [-0.5, 0.5] as [number, number] },
  { id: 'above', range: [0.5, Infinity] as [number, number] },
]
const withBaseline = {
  ...plain,
  baseline: { kind: 'reference-date', frameId: plain.frames[0].id, label: 'January 2024', noiseFloor: 0.2 },
  mapping: { ...plain.mapping, changeSteps, contourLevels: [{ value: 1 }] },
} as unknown as Visualization

const line = (level: number, points: [number, number][]): Contour => ({
  level, closed: false, brokenEnds: 0, brokenStart: false, brokenEnd: false, points: points.map(([x, y]) => ({ x, y, turn: 0, front: 1 })),
})
const NW_TO_CENTRE = line(1, [[0.1, 0.1], [0.3, 0.3], [0.5, 0.5]])
const SOUTH = line(2, [[0.5, 0.8], [0.5, 0.9]])

const engine = vi.hoisted(() => ({
  steps: [] as Record<string, unknown>[][],
  traced: [] as unknown[],
  traceEnd: (_line: Contour) => {},
  unlock: vi.fn(async () => {}),
  setVolume: vi.fn(),
  setStyle: vi.fn(),
  setSpatial: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  renderToWav: vi.fn(),
  playSequence: vi.fn((steps: Record<string, unknown>[]) => { engine.steps.push(steps) }),
  // Sounds the last point at once, as a finished trace would.
  traceContour: vi.fn((contour: Contour, onPoint?: (i: number) => void) => {
    engine.traced.push(contour)
    onPoint?.(contour.points.length - 1)
  }),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))

const analyzeAll = vi.hoisted(() => vi.fn())
const analyzeChange = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll, analyzeChange }))

const STEPS = ['below', 'near-normal', 'above', 'insufficient'] as const
const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const
const results = (withChange: boolean) => plain.frames.map((frame, i) => ({
  frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: CATEGORIES[i],
  ...(withChange && { changeStep: STEPS[i], ...(i < 3 && { medianChange: [-1, 0, 1.2][i] }) }),
}))
let contours: Contour[] = []
const score = (): Score => ({ frameId: plain.frames[0].id, change: { step: 'above', medianChange: 0.8, shareAbove: [0.4], validFraction: 0.9 }, contours })

beforeEach(() => {
  vi.clearAllMocks()
  engine.steps = []
  engine.traced = []
  contours = [NW_TO_CENTRE]
  analyzeAll.mockImplementation(async (_f, _r, _c, _m, v?: unknown) => results(!!v))
  analyzeChange.mockImplementation(async () => score())
})
afterEach(() => localStorage.clear())

async function renderReady(visualization: Visualization) {
  const user = userEvent.setup()
  const view = render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled())
  return { user, ...view }
}

describe('Listen with no baseline (v1)', () => {
  it('keeps the Simple sound button, has no radio group and no trace button', async () => {
    await renderReady(plain)
    expect(screen.getByRole('button', { name: 'Simple sound' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Trace the warm edge' })).toBeNull()
    expect(analyzeAll).toHaveBeenCalledWith(plain.frames, plain.regions[0], plain.colorScale, plain.mapping)
    expect(analyzeChange).not.toHaveBeenCalled()
  })

  it('plays a remembered "change" as "full", and its steps carry no change step', async () => {
    localStorage.setItem('earth-jukebox:sound-style', 'change')
    const { user } = await renderReady(plain)
    expect(engine.setStyle).toHaveBeenLastCalledWith('full')
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(engine.steps.length).toBe(1))
    expect(engine.steps[0].every(step => !('changeStep' in step) && !('medianChange' in step))).toBe(true)
  })

  it('ignores the T key', async () => {
    const { user } = await renderReady(plain)
    await user.keyboard('t')
    expect(engine.traceContour).not.toHaveBeenCalled()
  })
})

describe('Listen with a baseline', () => {
  it('offers Full, Simple and Change from normal as a radio group, with Full chosen, and no trace button yet', async () => {
    await renderReady(withBaseline)
    const group = screen.getByRole('radiogroup', { name: 'Sound' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Full' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Simple' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Change from normal' })).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Trace the warm edge' })).toBeNull()
    expect(analyzeAll).toHaveBeenCalledWith(withBaseline.frames, withBaseline.regions[0], withBaseline.colorScale, withBaseline.mapping, withBaseline)
  })

  it('explains the change sound without naming a temperature (I02)', async () => {
    const { user } = await renderReady(withBaseline)
    await user.click(screen.getByRole('radio', { name: 'Change from normal' }))
    expect(screen.getByText('Hear how far each date is from its normal, not the value itself.')).toBeInTheDocument()
  })

  it('puts the change step and size on each step in the change style, and on none in the others', async () => {
    const { user } = await renderReady(withBaseline)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(engine.steps.length).toBe(1))
    expect(engine.steps[0].some(step => 'changeStep' in step)).toBe(false)

    await user.click(screen.getByRole('radio', { name: 'Change from normal' }))
    expect(engine.setStyle).toHaveBeenLastCalledWith('change')
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(engine.steps.length).toBe(2))
    expect(engine.steps[1].map(step => step.changeStep)).toEqual(['below', 'near-normal', 'above', 'insufficient'])
    expect(engine.steps[1].map(step => step.medianChange)).toEqual([-1, 0, 1.2, undefined])

    await user.click(screen.getByRole('radio', { name: 'Simple' }))
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(engine.steps.length).toBe(3))
    expect(engine.steps[2].some(step => 'changeStep' in step)).toBe(false)
  })

  it('describes the change of the date on screen, as "change since <date>"', async () => {
    const { user } = await renderReady(withBaseline)
    await user.click(screen.getByRole('radio', { name: 'Change from normal' }))
    expect(await screen.findByText(/Change since January 2024: \+0\.8 °C \(above\)\./)).toBeInTheDocument()
    expect(screen.queryByText(/anomal/i)).toBeNull()
  })

  it('passes the axe check in the change style', async () => {
    const { user, container } = await renderReady(withBaseline)
    await user.click(screen.getByRole('radio', { name: 'Change from normal' }))
    await screen.findByRole('button', { name: 'Trace the warm edge' })
    await expectNoA11yViolations(container)
  })
})

describe('Assistant context', () => {
  it('carries the change step in the change style only', async () => {
    const seen: ContextUpdate[] = []
    const unsubscribe = subscribeContext(update => seen.push(update))
    const { user } = await renderReady(withBaseline)
    const last = () => seen.filter(u => u.key === 'player').at(-1)?.data as Record<string, unknown>
    await waitFor(() => expect(last()).toBeDefined())
    expect('changeStep' in last()).toBe(false)
    await user.click(screen.getByRole('radio', { name: 'Change from normal' }))
    await waitFor(() => expect(last().changeStep).toBe('below'))
    unsubscribe()
  })
})

describe('Trace the warm edge', () => {
  async function inChangeStyle(expectEnabled = true) {
    const view = await renderReady(withBaseline)
    await view.user.click(screen.getByRole('radio', { name: 'Change from normal' }))
    const button = await screen.findByRole('button', { name: 'Trace the warm edge' })
    if (expectEnabled) await waitFor(() => expect(button).toBeEnabled())
    else await waitFor(() => expect(analyzeChange).toHaveBeenCalled())
    return { ...view, button }
  }

  it('traces the contour of the date and says it in words', async () => {
    const { user, button } = await inChangeStyle()
    await user.click(button)
    await waitFor(() => expect(engine.traceContour).toHaveBeenCalledTimes(1))
    expect(engine.traced[0]).toBe(NW_TO_CENTRE)
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain('A +1 °C line runs from the north-west to the centre')
  })

  it('keeps the button disabled and says why when the change cannot be read', async () => {
    analyzeChange.mockRejectedValue(new Error('The reference frame ref-1 does not exist.'))
    const { container, button } = await inChangeStyle(false)
    expect(button).toBeDisabled()
    expect(await screen.findByText(/nothing to trace. The reference frame ref-1 does not exist./)).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain('The reference frame ref-1 does not exist.'))
    await expectNoA11yViolations(container)
  })

  it('traces every picked line in turn', async () => {
    contours = [NW_TO_CENTRE, SOUTH]
    const { user, button } = await inChangeStyle()
    await user.click(button)
    await waitFor(() => expect(engine.traceContour).toHaveBeenCalledTimes(2), { timeout: 3000 })
    expect(engine.traced).toEqual([NW_TO_CENTRE, SOUTH])
  })

  it('is started by the trace action, which T makes on the sound map (IX01)', async () => {
    await inChangeStyle()
    act(() => { dispatch({ type: 'trace' }) })
    await waitFor(() => expect(engine.traceContour).toHaveBeenCalledTimes(1))
  })

  it('does not start on a T pressed outside the sound map: a single letter works only there (WCAG 2.1.4)', async () => {
    const { user } = await inChangeStyle()
    await user.keyboard('t')
    expect(engine.traceContour).not.toHaveBeenCalled()
  })

  it('is disabled when the date has no contour, and a trace says so instead of playing', async () => {
    contours = []
    const { button } = await inChangeStyle(false)
    expect(button).toBeDisabled()
    act(() => { dispatch({ type: 'trace' }) })
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain('There is no warm edge on this date.'))
    expect(engine.traceContour).not.toHaveBeenCalled()
  })

  it('stops with Stop: the next line never starts', async () => {
    contours = [NW_TO_CENTRE, SOUTH]
    const { user, button } = await inChangeStyle()
    await user.click(button)
    await waitFor(() => expect(engine.traceContour).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(engine.stop).toHaveBeenCalled()
    await new Promise(done => setTimeout(done, 900))
    expect(engine.traceContour).toHaveBeenCalledTimes(1)
  })

  it('stops with Escape while tracing', async () => {
    contours = [NW_TO_CENTRE, SOUTH]
    const { user, button } = await inChangeStyle()
    await user.click(button)
    await waitFor(() => expect(engine.traceContour).toHaveBeenCalledTimes(1))
    await user.keyboard('{Escape}')
    await new Promise(done => setTimeout(done, 900))
    expect(engine.traceContour).toHaveBeenCalledTimes(1)
  })
})
