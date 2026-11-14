import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnouncerProvider } from '../../components'
import { forgetKeptValues } from '../../hooks/useStoredValue'
import { expectNoA11yViolations } from '../../test/a11y'
import { cleanName } from './listenForName'
import { INTRO_KEY, readIntro } from './storage'

vi.mock('../home/OrbitGlobe', () => ({ default: () => <canvas aria-hidden="true" /> }))
const speak = vi.fn((_text: string) => Promise.resolve())
vi.mock('../welcome/speak', () => ({ speak: (t: string) => speak(t), hush: vi.fn() }))

import Intro from './Intro'

const show = () => render(<AnnouncerProvider><Intro /></AnnouncerProvider>)

beforeEach(() => { localStorage.clear(); forgetKeptValues(); speak.mockClear(); vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Intro', () => {
  it('says nothing before Start', async () => {
    const { container } = show()
    expect(speak).not.toHaveBeenCalled()
    await expectNoA11yViolations(container)
  })

  it('Start makes Echo ask the question aloud', async () => {
    show()
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Start' }))
    expect(speak).toHaveBeenCalledWith(expect.stringContaining('What should I call you?'))
  })

  it('saves a typed name after the fade', async () => {
    show()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.type(screen.getByRole('textbox', { name: /your name/i }), 'Ana')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(readIntro().seen).toBe(false)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(JSON.parse(localStorage.getItem(INTRO_KEY) ?? '{}')).toEqual({ seen: true, name: 'Ana' })
  })

  it('Skip saves seen with no name', async () => {
    show()
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Skip the intro' }))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(readIntro()).toEqual({ seen: true })
  })

  it('has no microphone button without speech recognition', () => {
    show()
    expect(screen.queryByRole('button', { name: 'Say my name' })).toBeNull()
  })
})

describe('cleanName', () => {
  it.each([['my name is Ana.', 'Ana'], ["I'm Sam", 'Sam'], ['call me Bo', 'Bo'], ['Maria', 'Maria']])('%s', (said, name) => {
    expect(cleanName(said)).toBe(name)
  })
})
