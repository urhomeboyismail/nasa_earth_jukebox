import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import LearnPage from '.'

const visualization = fixture as Visualization

// The stub engine, recording the order of calls so a test can check unlock() comes first.
const calls = vi.hoisted(() => [] as string[])
const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => { calls.push('unlock') }),
  playCategory: vi.fn((id: string) => { calls.push(`category:${id}`) }),
  playTick: vi.fn(() => { calls.push('tick') }),
  playMissing: vi.fn(() => { calls.push('missing') }),
  playSequence: vi.fn((_steps: unknown, _onStep: (i: number) => void) => { calls.push('sequence') }),
  stop: vi.fn(() => { calls.push('stop') }),
  setStyle: vi.fn(),
}))
const createSoundEngine = vi.hoisted(() => vi.fn((_mapping: unknown) => engine))
vi.mock('../../audio', () => ({ createSoundEngine }))

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
  createSoundEngine.mockImplementation(() => engine)
})

describe('Learn page', () => {
  it('shows a loading message until the data arrives', () => {
    render(<LearnPage visualization={null} />)
    expect(screen.getByText(/Loading the sounds/)).toBeInTheDocument()
    expect(createSoundEngine).not.toHaveBeenCalled()
  })

  it('has one button per category, each saying what it plays, plus the tick and the missing-data cue', () => {
    render(<LearnPage visualization={visualization} />)
    for (const category of visualization.mapping.categories) {
      expect(screen.getByRole('button', { name: `Play: ${category.label}` })).toBeEnabled()
      expect(screen.getByText(new RegExp(`Plays the note ${category.note}`))).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Play: the tick' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play: missing data' })).toBeInTheDocument()
    expect(screen.getByText(/Cold, Cool, Mild, Warm, Hot/)).toBeInTheDocument()
  })

  it('gives each category its temperature range from the data, not typed by hand', () => {
    render(<LearnPage visualization={visualization} />)
    expect(screen.getByText(/0 to 6 °C/)).toBeInTheDocument()
    expect(screen.getByText(/24 to 30 °C/)).toBeInTheDocument()
  })

  it('unlocks the sound before the first sound, then plays that category', async () => {
    render(<LearnPage visualization={visualization} />)
    await userEvent.click(screen.getByRole('button', { name: 'Play: Warm' }))
    expect(calls.filter(c => c !== 'stop')).toEqual(['unlock', 'category:warm'])
  })

  it('plays the tick and the missing-data cue', async () => {
    render(<LearnPage visualization={visualization} />)
    await userEvent.click(screen.getByRole('button', { name: 'Play: the tick' }))
    await userEvent.click(screen.getByRole('button', { name: 'Play: missing data' }))
    expect(engine.playTick).toHaveBeenCalledTimes(1)
    expect(engine.playMissing).toHaveBeenCalledTimes(1)
  })

  it('works by keyboard alone', async () => {
    render(<LearnPage visualization={visualization} />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Play: Cold' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(engine.playCategory).toHaveBeenCalledWith('cold')
    await userEvent.tab()
    await userEvent.keyboard(' ')
    expect(engine.playCategory).toHaveBeenLastCalledWith('cool')
  })

  it('plays all sounds from coolest to warmest, with a gap between them', async () => {
    render(<LearnPage visualization={visualization} />)
    await userEvent.click(screen.getByRole('button', { name: 'Play all, coolest to warmest' }))
    const steps = engine.playSequence.mock.calls[0][0] as { category: string; atMs: number }[]
    expect(steps.map(step => step.category)).toEqual(['cold', 'cool', 'mild', 'warm', 'hot'])
    expect(steps.map(step => step.atMs)).toEqual([0, 1200, 2400, 3600, 4800])
  })

  it('has a Stop button that is enabled only while "Play all" runs and silences the sounds', async () => {
    render(<LearnPage visualization={visualization} />)
    const stop = screen.getByRole('button', { name: 'Stop' })
    expect(stop).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Play all, coolest to warmest' }))
    expect(stop).toBeEnabled()
    engine.stop.mockClear()
    await userEvent.click(stop)
    expect(engine.stop).toHaveBeenCalled()
    expect(stop).toBeDisabled()
  })

  it('links on to Listen', () => {
    render(<LearnPage visualization={visualization} />)
    expect(screen.getByRole('link', { name: 'Go to Listen' })).toHaveAttribute('href', '#listen')
  })

  it('silences the sounds when the page is left', () => {
    const { unmount } = render(<LearnPage visualization={visualization} />)
    engine.stop.mockClear()
    unmount()
    expect(engine.stop).toHaveBeenCalled()
  })

  it('says what went wrong, and disables playing, when the sounds cannot be set up', () => {
    createSoundEngine.mockImplementation(() => { throw new Error('Category "cool" (D4) must sound higher than the category before it.') })
    render(<LearnPage visualization={visualization} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be set up.*must sound higher/)
    expect(screen.getByRole('button', { name: 'Play: Cold' })).toBeDisabled()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<main><h1>Learn the sounds</h1><LearnPage visualization={visualization} /></main>)
    await expectNoA11yViolations(container)
  })
})
