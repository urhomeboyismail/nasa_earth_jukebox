import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  setSpatial: vi.fn(),
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

describe('Learn page: the chord, the slide and the bell', () => {
  afterEach(() => { localStorage.clear(); window.location.hash = '' })

  it('has a card for each, with its explanation', () => {
    render(<LearnPage visualization={visualization} />)
    for (const title of ['The soft chord underneath', 'The slide', 'The bell']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(screen.getByText(/all one temperature you hear one deep note under the melody/)).toBeInTheDocument()
    expect(screen.getByText(/A longer slide is a bigger change/)).toBeInTheDocument()
    expect(screen.getByText(/two or more steps at once/)).toBeInTheDocument()
  })

  it('plays a single deep note for "all warm", and the chord of cool, mild and warm for "mixed"', async () => {
    render(<LearnPage visualization={visualization} />)
    await userEvent.click(screen.getByRole('button', { name: 'Play: all warm' }))
    expect(engine.playCategory).toHaveBeenLastCalledWith('warm', { pad: ['warm'] })
    await userEvent.click(screen.getByRole('button', { name: 'Play: mixed' }))
    expect(engine.playCategory).toHaveBeenLastCalledWith('mild', { pad: ['cool', 'mild', 'warm'] })
  })

  it('plays cool then hot with the slide on the second note, and no tick', async () => {
    render(<LearnPage visualization={visualization} />)
    await userEvent.click(screen.getByRole('button', { name: 'Play: the slide' }))
    const [steps, , options] = engine.playSequence.mock.calls[0] as unknown as [{ category: string; atMs: number; glide?: boolean; bell?: boolean }[], unknown, unknown]
    expect(steps.map(step => step.category)).toEqual(['cool', 'hot'])
    expect(steps[0]).not.toHaveProperty('glide')
    expect(steps[1]).toMatchObject({ glide: true })
    expect(steps[1]).not.toHaveProperty('bell')
    expect(steps[1].atMs).toBeGreaterThan(0)
    expect(options).toEqual({ tick: false })
  })

  it('plays cool then hot with the bell on the second note', async () => {
    render(<LearnPage visualization={visualization} />)
    await userEvent.click(screen.getByRole('button', { name: 'Play: the bell' }))
    const [steps] = engine.playSequence.mock.calls[0] as unknown as [{ category: string; glide?: boolean; bell?: boolean }[]]
    expect(steps.map(step => step.category)).toEqual(['cool', 'hot'])
    expect(steps[1]).toMatchObject({ bell: true })
    expect(steps[1]).not.toHaveProperty('glide')
  })

  it('finds the notes by position, so it works for a data set with two categories', async () => {
    const two: Visualization = { ...visualization, mapping: { ...visualization.mapping, categories: [visualization.mapping.categories[0], visualization.mapping.categories[2]] } }
    render(<LearnPage visualization={two} />)
    await userEvent.click(screen.getByRole('button', { name: 'Play: mixed' }))
    expect(engine.playCategory).toHaveBeenLastCalledWith('mild', { pad: ['cold', 'mild'] })
  })

  it('unlocks the sound first, like every other button', async () => {
    render(<LearnPage visualization={visualization} />)
    await userEvent.click(screen.getByRole('button', { name: 'Play: the bell' }))
    expect(calls.filter(c => c !== 'stop')).toEqual(['unlock', 'sequence'])
  })

  it('hides the three cards in the simple style, and says only the main note is heard', () => {
    localStorage.setItem('earth-jukebox:sound-style', 'simple')
    render(<LearnPage visualization={visualization} />)
    expect(screen.getByText('Simple sound is on: you hear only the main note.')).toBeInTheDocument()
    for (const title of ['The soft chord underneath', 'The slide', 'The bell']) {
      expect(screen.queryByRole('heading', { name: title })).toBeNull()
    }
    expect(screen.queryByRole('button', { name: 'Play: the slide' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Play: Warm' })).toBeInTheDocument()
  })

  it('sets the engine to the remembered style', () => {
    localStorage.setItem('earth-jukebox:sound-style', 'simple')
    render(<LearnPage visualization={visualization} />)
    expect(engine.setStyle).toHaveBeenLastCalledWith('simple')
  })
})

describe('Learn page: explore the map', () => {
  afterEach(() => { window.location.hash = '' })

  it('says what the explorer does, its keys, and the sliders for phones', () => {
    render(<LearnPage visualization={visualization} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Explore the map' })).toBeInTheDocument()
    expect(screen.getByText(/Arrow keys move one place/)).toBeInTheDocument()
    expect(screen.getByText(/Enter plays the row from west to east/)).toBeInTheDocument()
    expect(screen.getByText(/On a phone, use the two sliders/)).toBeInTheDocument()
  })

  it('links to Listen, and keeps the chosen data set', () => {
    window.location.hash = '#learn?data=synthetic-globe'
    render(<LearnPage visualization={visualization} />)
    expect(screen.getByRole('link', { name: 'Try Explore the map on Listen' })).toHaveAttribute('href', '#listen?data=synthetic-globe')
    expect(screen.getByRole('link', { name: 'Go to Listen' })).toHaveAttribute('href', '#listen?data=synthetic-globe')
  })
})
