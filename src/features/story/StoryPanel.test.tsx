import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { describeSequence } from '../../describe'
import { expectNoA11yViolations } from '../../test/a11y'
import PlayerPage from '../player'

// The fixture has four dates (cold, mild, hot, no data). Three chapters over them: two dates, three dates, one date.
const base = fixture as Visualization
const visualization: Visualization = {
  ...base,
  story: [
    { id: 'start', title: 'The cold start', text: 'It begins cold.', fromFrame: '2024-01-15', toFrame: '2024-07-15' },
    { id: 'heat', title: 'The heat', text: 'Then it gets hot.', fromFrame: '2024-07-15', toFrame: '2025-03-15' },
    { id: 'gap', title: 'The gap', text: 'Then the data stops.', fromFrame: '2025-03-15', toFrame: '2025-03-15' },
  ],
}

const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => {}),
  setStyle: vi.fn(),
  setVolume: vi.fn(),
  playCategory: vi.fn(),
  playMissing: vi.fn(),
  playSequence: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  renderToWav: vi.fn(),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))

const analyzeAll = vi.hoisted(() => vi.fn())
const analyzeGrid = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll, analyzeGrid }))

const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const
const results = () => visualization.frames.map((frame, i) => ({
  frameId: frame.id, regionId: 'centre', sampled: 9, valid: i === 3 ? 0 : 9, category: CATEGORIES[i], ...(i === 3 ? {} : { medianValue: [3, 15, 27][i] }),
}))

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const heading = () => screen.getByRole('heading', { level: 2, name: /^Chapter|^The end of the story/ })
const storyButton = () => screen.getByRole('button', { name: 'Hear the story' })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  Object.values(engine).forEach(fn => fn.mockClear())
  analyzeAll.mockReset()
  analyzeAll.mockImplementation(async () => results())
  analyzeGrid.mockReset()
  analyzeGrid.mockImplementation(async (frame: { id: string }) => ({
    frameId: frame.id, cols: 2, rows: 2, area: { x0: 0, y0: 0, x1: 1, y1: 1 }, cells: Array(4).fill({ value: 3, category: 'cold' }),
  }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function ready(data: Visualization = visualization) {
  const user = userEvent.setup({ delay: null })
  const view = render(<PlayerPage visualization={data} />)
  await tick(0)
  return { user, ...view }
}
async function opened() {
  const view = await ready()
  await view.user.click(storyButton())
  return view
}
const lastSteps = () => engine.playSequence.mock.calls.at(-1)![0] as { category: string; atMs: number }[]

describe('Story: when it shows', () => {
  it('has a "Hear the story" button only when the data has a story', async () => {
    const first = await ready(base)
    expect(screen.queryByRole('button', { name: 'Hear the story' })).toBeNull()
    first.unmount()
    await ready()
    expect(storyButton()).toBeEnabled()
  })

  it('puts the button above the playback controls, and opens the story inline, not as a dialog', async () => {
    const { user, container } = await ready()
    const buttons: HTMLElement[] = [...container.querySelectorAll('button')]
    expect(buttons.indexOf(storyButton())).toBeLessThan(buttons.indexOf(screen.getByRole('button', { name: 'Play' })))
    await user.click(storyButton())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('region', { name: 'Story' })).toBeInTheDocument()
    expect(storyButton()).toHaveAttribute('aria-expanded', 'true')
  })

  it('waits for the analysis before it can be opened', async () => {
    analyzeAll.mockImplementation(() => new Promise(() => {}))
    render(<PlayerPage visualization={visualization} />)
    expect(storyButton()).toBeDisabled()
  })
})

describe('Story: the chapters', () => {
  it('shows chapter 1 of 3 with its title and text, and moves focus to the heading', async () => {
    await opened()
    expect(heading()).toHaveTextContent('Chapter 1 of 3: The cold start')
    expect(heading()).toHaveAttribute('tabindex', '-1')
    expect(heading()).toHaveFocus()
    expect(screen.getByText('It begins cold.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous chapter' })).toBeDisabled()
  })

  it('moves to the next and previous chapter, with focus on the heading each time', async () => {
    const { user } = await opened()
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    expect(heading()).toHaveTextContent('Chapter 2 of 3: The heat')
    expect(heading()).toHaveFocus()
    expect(screen.getByText('Then it gets hot.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous chapter' }))
    expect(heading()).toHaveTextContent('Chapter 1 of 3: The cold start')
    expect(heading()).toHaveFocus()
  })

  it('never moves on by itself', async () => {
    await opened()
    await tick(60_000)
    expect(heading()).toHaveTextContent('Chapter 1 of 3')
  })

  it('on the last chapter, "Next chapter" becomes "Finish", which shows the end and the summary', async () => {
    const { user } = await opened()
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    expect(screen.queryByRole('button', { name: 'Next chapter' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(heading()).toHaveTextContent('The end of the story.')
    expect(heading()).toHaveFocus()
    expect(screen.getByRole('region', { name: 'Story' })).toHaveTextContent(describeSequence(visualization, results()))
    expect(screen.queryByRole('button', { name: 'Play this part' })).toBeNull()
  })

  it('can go back from the end to the last chapter', async () => {
    const { user } = await opened()
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    await user.click(screen.getByRole('button', { name: 'Previous chapter' }))
    expect(heading()).toHaveTextContent('Chapter 3 of 3: The gap')
  })
})

describe('Story: playing a part', () => {
  it('plays only the dates of the chapter, with the same voicing as a full run', async () => {
    const { user } = await opened()
    await user.click(screen.getByRole('button', { name: 'Play this part' }))
    expect(lastSteps().map(step => step.category)).toEqual(['cold', 'mild'])
    expect(lastSteps().map(step => step.atMs)).toEqual([0, 1000])
    expect(lastSteps()[1]).toMatchObject({ glide: true, bell: true, pan: expect.any(Number) })
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    await user.click(screen.getByRole('button', { name: 'Play this part' }))
    expect(lastSteps().map(step => step.category)).toEqual(['mild', 'hot', 'insufficient'])
  })

  it('plays a chapter of one date as one step', async () => {
    const { user } = await opened()
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    await user.click(screen.getByRole('button', { name: 'Play this part' }))
    expect(lastSteps().map(step => step.category)).toEqual(['insufficient'])
  })

  it('follows the dates on the picture and stops at the end of the chapter, without saying it is the last date', async () => {
    const { user } = await opened()
    await user.click(screen.getByRole('button', { name: 'Play this part' }))
    const onStep = engine.playSequence.mock.calls[0][1] as (k: number) => void
    act(() => onStep(0))
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('0')
    act(() => onStep(1))
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('1')
    await tick(1000)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.queryByText(/That is the last date/)).toBeNull()
  })

  it('keeps to the chapter when the speed is changed while it plays', async () => {
    const { user } = await opened()
    await user.click(screen.getByRole('button', { name: 'Play this part' }))
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Fast' }))
    await tick(0)
    expect(lastSteps().map(step => step.atMs)).toEqual([0, 500])
  })
})

describe('Story: closing', () => {
  it('stops the sound, removes the panel and returns focus to "Hear the story"', async () => {
    const { user } = await opened()
    await user.click(screen.getByRole('button', { name: 'Play this part' }))
    engine.stop.mockClear()
    await user.click(screen.getByRole('button', { name: 'Close story' }))
    expect(engine.stop).toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Story' })).toBeNull()
    expect(storyButton()).toHaveFocus()
    expect(storyButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('starts again at chapter 1 when reopened', async () => {
    const { user } = await opened()
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    await user.click(screen.getByRole('button', { name: 'Close story' }))
    await user.click(storyButton())
    expect(heading()).toHaveTextContent('Chapter 1 of 3')
  })
})

describe('Story: with the sound map', () => {
  it('turns the explorer off when it opens, and keeps "Explore the map" disabled until it closes', async () => {
    const { user } = await ready()
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await tick(0)
    expect(screen.getByRole('application')).toBeInTheDocument()
    await user.click(storyButton())
    expect(screen.queryByRole('application')).toBeNull()
    expect(screen.getByRole('button', { name: 'Explore the map' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Close story' }))
    expect(screen.getByRole('button', { name: 'Explore the map' })).toBeEnabled()
  })
})

describe('Story: accessibility', () => {
  it('has no violations, in a chapter and at the end', async () => {
    const { user, container } = await opened()
    vi.useRealTimers()
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    await user.click(screen.getByRole('button', { name: 'Next chapter' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    await expectNoA11yViolations(container)
    expect(within(screen.getByRole('region', { name: 'Story' })).getAllByRole('button').length).toBeGreaterThan(1)
  })
})
