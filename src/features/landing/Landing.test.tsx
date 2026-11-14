import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readAudioPrefs } from '../../audio/prefs'
import { AnnouncerProvider } from '../../components'
import { forgetKeptValues } from '../../hooks/useStoredValue'
import { expectNoA11yViolations } from '../../test/a11y'
import { readIntro } from '../intro/storage'
import Landing from './Landing'
import { AUDIO_PREFERENCE_KEY, ONBOARDING_DONE_KEY, readLandingDone, USER_NAME_KEY } from './storage'

vi.mock('../home/OrbitGlobe', () => ({ default: () => <canvas aria-hidden="true" /> }))

const speak = vi.hoisted(() => vi.fn((_text: string) => Promise.resolve()))
vi.mock('../welcome/speak', () => ({ speak, hush: vi.fn() }))

const onDone = vi.fn()
const show = () => render(<AnnouncerProvider><Landing onDone={onDone} /></AnnouncerProvider>)

beforeEach(() => { localStorage.clear(); forgetKeptValues(); onDone.mockClear(); speak.mockClear() })
afterEach(() => localStorage.clear())

describe('Landing', () => {
  it('asks the name first, with Next and a way to skip the question', async () => {
    show()
    expect(screen.getByText(/Commander! Welcome to the Earth Information Jukebox/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /What should I call you/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip this question' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prefer manual setup?' })).toBeInTheDocument()
  })

  it('greets by name, offers four sounds, remembers the choice and enters', async () => {
    const user = userEvent.setup()
    show()
    await user.type(screen.getByRole('textbox', { name: /What should I call you/ }), 'Ana')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('list', { name: 'Conversation with Echo' })).toHaveTextContent('Great to meet you, Ana! What kind of sound vibe')
    expect(screen.getByRole('heading', { name: 'Your sound' })).toHaveFocus()
    const group = screen.getByRole('group', { name: 'Sound vibe' })
    expect([...group.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Cinematic Orchestral', '8-Bit Arcade', 'Nature Ambient', 'Heavy Bass'])
    await user.click(screen.getByRole('button', { name: '8-Bit Arcade' }))
    expect(screen.getByRole('button', { name: '8-Bit Arcade' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Enter Earth Jukebox' }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(USER_NAME_KEY)).toBe('Ana')
    expect(localStorage.getItem(AUDIO_PREFERENCE_KEY)).toBe('chiptune')
    expect(localStorage.getItem(ONBOARDING_DONE_KEY)).toBe('true')
    expect(readIntro().name).toBe('Ana')
    expect(readAudioPrefs().style).toBe('chiptune')
  })

  it('calls the listener Commander when the name is skipped, and Back returns to the name', async () => {
    const user = userEvent.setup()
    show()
    await user.click(screen.getByRole('button', { name: 'Skip this question' }))
    expect(screen.getByRole('list', { name: 'Conversation with Echo' })).toHaveTextContent('Great to meet you, Commander!')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('textbox', { name: /What should I call you/ })).toBeInTheDocument()
  })

  it('manual setup is one form with a name and an audio preference', async () => {
    const user = userEvent.setup()
    show()
    await user.click(screen.getByRole('button', { name: 'Prefer manual setup?' }))
    await user.type(screen.getByRole('textbox', { name: /Your name/ }), 'Bo')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Audio preference' }), 'Heavy Bass')
    await user.click(screen.getByRole('button', { name: 'Enter Earth Jukebox' }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(USER_NAME_KEY)).toBe('Bo')
    expect(localStorage.getItem(AUDIO_PREFERENCE_KEY)).toBe('bass')
    expect(readLandingDone()).toBe(true)
  })

  it('Skip the welcome is done without saving answers', async () => {
    const user = userEvent.setup()
    show()
    await user.click(screen.getByRole('button', { name: 'Skip the welcome' }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(readLandingDone()).toBe(true)
    expect(localStorage.getItem(USER_NAME_KEY)).toBeNull()
  })

  it('is silent until Hear Echo is pressed, then speaks the line and each one after', async () => {
    const user = userEvent.setup()
    show()
    expect(speak).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Hear Echo' }))
    expect(screen.getByRole('button', { name: 'Hear Echo' })).toHaveAttribute('aria-pressed', 'true')
    expect(speak).toHaveBeenLastCalledWith(expect.stringContaining('What should I call you?'))
    await user.click(screen.getByRole('button', { name: 'Skip this question' }))
    expect(speak).toHaveBeenLastCalledWith(expect.stringContaining('Great to meet you, Commander!'))
    await user.click(screen.getByRole('button', { name: 'Hear Echo' }))
    expect(screen.getByRole('button', { name: 'Hear Echo' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(speak).toHaveBeenCalledTimes(2)
  })

  it('has no accessibility violations in either step or the manual form', async () => {
    const user = userEvent.setup()
    const { container } = show()
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('button', { name: 'Skip this question' }))
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('button', { name: 'Prefer manual setup?' }))
    await expectNoA11yViolations(container)
  })
})
