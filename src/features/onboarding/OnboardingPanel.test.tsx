import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { AnnouncerContext } from '../../components/announcerContext'
import { variableWords, type Visualization } from '../../data'
import { resetActionHandlers, useActionHandler } from '../../interaction/registry'
import { useKeyboard } from '../../interaction/useInput'
import { expectNoA11yViolations } from '../../test/a11y'
import { OnboardingPanel } from './OnboardingPanel'
import { ONBOARDING_KEY, readOnboardingDone, resetOnboarding } from './store'
import { useOnboarding } from './useOnboarding'

const visualization = fixture as Visualization
const words = variableWords(visualization.variable)

const GRID = { frameId: 'f', cols: 24, rows: 12, area: { x0: 0, y0: 0, x1: 1, y1: 1 }, cells: [] }
const ensemble = { playNotes: vi.fn(), playDropout: vi.fn(), now: vi.fn(() => 0), status: vi.fn(() => 'on' as const) }
const announce = vi.fn()
const SCOPES = ['map', 'listen', 'anywhere'] as const

/** The player's part of the game: keys become actions, the find game reports a target found, and the date slider tells the game of a date change. */
function Harness({ on = true, cursor = { col: 5, row: 5 } }: { on?: boolean; cursor?: { col: number; row: number } }) {
  const [findStatus, setFindStatus] = useState('idle')
  useActionHandler('find', () => setFindStatus('found'))
  const onboarding = useOnboarding({ visualization, explorer: { on, ensemble, cursor, grid: GRID }, findStatus })
  const onKeyDown = useKeyboard(SCOPES)
  return (
    <div onKeyDown={onKeyDown}>
      <button type="button">Sound map</button>
      <input type="range" aria-label="Date" min={0} max={3} defaultValue={0} onChange={() => onboarding.record({ type: 'scrubTime', by: 1 })} />
      <OnboardingPanel onboarding={onboarding} />
    </div>
  )
}

const view = (on = true, cursor?: { col: number; row: number }) => render(<AnnouncerContext.Provider value={announce}><Harness on={on} cursor={cursor} /></AnnouncerContext.Provider>)
const prompt = () => document.querySelector('.onboarding__prompt')?.textContent ?? ''
const step = () => document.querySelector('.onboarding__step')?.textContent ?? ''
const focusMap = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole('button', { name: 'Sound map' })) }

beforeEach(() => {
  resetActionHandlers()
  resetOnboarding()
  localStorage.clear()
  Object.values(ensemble).forEach(fn => fn.mockClear())
  ensemble.status.mockReturnValue('on')
  announce.mockClear()
})
afterEach(() => { resetActionHandlers(); localStorage.clear() })

describe('the first-minute game', () => {
  it('shows the first step as text, and makes no sound and no announcement on its own', async () => {
    const { container } = view()
    expect(screen.getByRole('group', { name: 'First-minute game' })).toBeInTheDocument()
    expect(step()).toBe('Step 1 of 4')
    expect(prompt()).toBe('Move with an arrow key. Each place you land on makes a sound.')
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    expect(announce).not.toHaveBeenCalled()
    await expectNoA11yViolations(container)
  })

  it('is reached to Done by keyboard alone, with one chime and one announcement per step', async () => {
    const user = userEvent.setup()
    const { container } = view()
    await focusMap(user)

    await user.keyboard('{ArrowRight}{ArrowDown}')
    expect(step()).toBe('Step 1 of 4') // two moves are not enough
    await user.keyboard('{ArrowLeft}')
    expect(step()).toBe('Step 2 of 4')
    expect(prompt()).toBe(`Find the ${words.highest} place. Press F to start the find game.`)
    await expectNoA11yViolations(container)

    await user.keyboard('f')
    expect(step()).toBe('Step 3 of 4')
    expect(prompt()).toBe("Press I to ask what's here.")
    await expectNoA11yViolations(container)

    await user.keyboard('i')
    expect(step()).toBe('Step 4 of 4')
    expect(prompt()).toContain('Press L to lock this place')
    await expectNoA11yViolations(container)

    await user.keyboard('l')
    expect(step()).toBe('Step 4 of 4') // locked, but the dates have not moved yet
    fireEvent.change(screen.getByRole('slider', { name: 'Date' }), { target: { value: '1' } })
    expect(screen.queryByText(/Step \d of 4/)).not.toBeInTheDocument()
    expect(prompt()).toMatch(/^Done\./)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await expectNoA11yViolations(container)

    // Each step met chimed once (one playNotes call each), and each change was announced once.
    expect(ensemble.playNotes).toHaveBeenCalledTimes(4)
    expect(announce.mock.calls.map(call => call[0])).toStrictEqual([
      `Step 2 of 4. Find the ${words.highest} place. Press F to start the find game.`,
      "Step 3 of 4. Press I to ask what's here.",
      'Step 4 of 4. Press L to lock this place, then move the Date slider to hear it on other dates.',
      expect.stringMatching(/^Done\./),
    ])
    expect(readOnboardingDone()).toBe(true)
  })

  it('counts nothing while the sound map is off, and says to turn it on', async () => {
    const user = userEvent.setup()
    view(false)
    await focusMap(user)
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(step()).toBe('Step 1 of 4')
    expect(screen.getByText('First, press Explore the map to turn on the sound map.')).toBeInTheDocument()
    expect(ensemble.playNotes).not.toHaveBeenCalled()
  })

  it('does not count a press against the edge of the map, which lands on no new place', async () => {
    const user = userEvent.setup()
    view(true, { col: 0, row: 0 })
    await focusMap(user)
    await user.keyboard('{ArrowLeft}{ArrowUp}{ArrowLeft}')
    expect(step()).toBe('Step 1 of 4')
    expect(announce).not.toHaveBeenCalled()
    await user.keyboard('{ArrowRight}{ArrowDown}{ArrowRight}')
    expect(step()).toBe('Step 2 of 4')
  })

  it('keeps going when Escape is pressed', async () => {
    const user = userEvent.setup()
    view()
    await focusMap(user)
    await user.keyboard('{ArrowRight}{ArrowRight}{Escape}')
    expect(screen.getByRole('group', { name: 'First-minute game' })).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(step()).toBe('Step 2 of 4')
  })

  it('hides on Skip, remembers it, counts nothing after, and starts again from the button', async () => {
    const user = userEvent.setup()
    const { container } = view()
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('group', { name: 'First-minute game' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '')).toStrictEqual({ done: true })

    await focusMap(user)
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    expect(announce).not.toHaveBeenCalled()
    await expectNoA11yViolations(container)

    await user.click(screen.getByRole('button', { name: 'Play the first-minute game' }))
    expect(step()).toBe('Step 1 of 4')
    expect(readOnboardingDone()).toBe(false)
    await focusMap(user)
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(step()).toBe('Step 2 of 4')
  })

  it('closes after Done and is then offered again from the button', async () => {
    const user = userEvent.setup()
    view()
    await focusMap(user)
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}fil')
    fireEvent.change(screen.getByRole('slider', { name: 'Date' }), { target: { value: '1' } })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('group', { name: 'First-minute game' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play the first-minute game' })).toBeInTheDocument()
  })

  it('stays hidden on a visit after it was done or skipped', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ done: true }))
    view()
    expect(screen.queryByRole('group', { name: 'First-minute game' })).not.toBeInTheDocument()
  })

  it('treats a corrupt stored value as not done, so the game shows', () => {
    localStorage.setItem(ONBOARDING_KEY, 'garbage')
    view()
    expect(screen.getByRole('group', { name: 'First-minute game' })).toBeInTheDocument()
  })
})
