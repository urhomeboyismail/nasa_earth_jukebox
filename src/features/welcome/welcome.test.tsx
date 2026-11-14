import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { publishContext } from '../../assistant/context'
import { readDescriptionDetail } from '../../describe/detail'
import type { Visualization } from '../../data'
import { AnnouncerProvider } from '../../components'
import { readIntro, saveIntro } from '../intro/storage'
import { expectNoA11yViolations } from '../../test/a11y'
import { TOUR_STEPS } from '../demo/script'
import { getTour, stopTour } from '../mascot/tour'
import { onPlayerCommand, type PlayerCommand } from '../player/controls'
import HomePage from '../home'
import { CHAT_GREETING, lockedLine, MASCOT_NAME, tuneQuestion } from './lines'
import { readWelcome, resetWelcome, WELCOME_KEY } from './storage'

const visualization = fixture as Visualization

// A stand-in engine that records what it was asked to play.
const fake = vi.hoisted(() => {
  const engine = {
    unlocked: 0,
    sequences: [] as { category: string; atMs: number; pan?: number }[][],
    volumes: [] as number[],
    unlock: async () => { engine.unlocked += 1 },
    setVolume: (v: number) => { engine.volumes.push(v) },
    setStyle: (_style: string) => {},
    stop: () => {},
    playSequence(steps: { category: string; atMs: number; pan?: number }[]) { engine.sequences.push(steps) },
    reset() { engine.unlocked = 0; engine.sequences = []; engine.volumes = [] },
  }
  return engine
})
vi.mock('../../audio', () => ({ createSoundEngine: () => fake }))
const sample = vi.hoisted(() => ({ played: [] as string[] }))
vi.mock('../player/soundSample', () => ({ playSample: async (preset: { id: string }) => { sample.played.push(preset.id) } }))

const pans = () => fake.sequences.map(steps => steps[0].pan)

let commands: PlayerCommand[]
let off: () => void

beforeEach(() => {
  localStorage.clear()
  resetWelcome()
  fake.reset()
  window.location.hash = ''
  commands = []
  off = onPlayerCommand(command => commands.push(command))
})
afterEach(() => { off(); act(() => stopTour()); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); window.location.hash = '' })

/** Past the chat's name and sound questions, to the choice of path. */
async function toPaths(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Skip this question' }))
  await user.click(screen.getByRole('button', { name: 'Skip this question' }))
}

/** Home with the lazy welcome loaded. */
async function renderHome() {
  const view = render(<HomePage visualization={visualization} />)
  const welcome = await screen.findByRole('region', { name: 'Welcome' }).catch(() => null)
  return { ...view, welcome }
}

describe('the welcome on Home', () => {
  it('shows on a first visit, with Skip first in focus order and nothing sounding yet', async () => {
    const user = userEvent.setup()
    const { container } = await renderHome()
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`I'm ${MASCOT_NAME}`))).toBeInTheDocument()
    expect(screen.getByText(CHAT_GREETING)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /What should I call you/ })).toBeInTheDocument()
    // The first thing a keyboard reaches is Skip.
    await user.tab()
    expect(screen.getByRole('button', { name: 'Skip the welcome' })).toHaveFocus()
    // Nothing has played, unlocked or spoken before a click.
    expect(fake.unlocked).toBe(0)
    expect(fake.sequences).toHaveLength(0)
    // The drawing is decoration.
    expect(container.querySelector('.welcome__mascot')).toHaveAttribute('alt', '')
    await expectNoA11yViolations(container)
  })

  it('does not show on a second visit', async () => {
    const user = userEvent.setup()
    const first = await renderHome()
    await user.click(screen.getByRole('button', { name: 'Skip the welcome' }))
    first.unmount()
    const second = render(<HomePage visualization={visualization} />)
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByRole('heading', { name: 'Welcome' })).not.toBeInTheDocument()
    expect(readWelcome().done).toBe(true)
    second.unmount()
  })

  it('shows again when the remembered choice is cleared', async () => {
    localStorage.setItem(WELCOME_KEY, JSON.stringify({ done: true }))
    resetWelcome()
    await renderHome()
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
  })

  it('ignores a damaged stored choice', async () => {
    localStorage.setItem(WELCOME_KEY, '{"done":"yes","path":"nowhere","volume":7}')
    await renderHome()
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
  })

  it('still works when storage is blocked', async () => {
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    await renderHome()
    await user.click(screen.getByRole('button', { name: 'Skip the welcome' }))
    expect(screen.queryByRole('heading', { name: 'Welcome' })).not.toBeInTheDocument()
    vi.restoreAllMocks()
  })
})

describe('the chat', () => {
  it('asks the name, greets by it, saves the sound chosen and the name, then asks for the path', async () => {
    const user = userEvent.setup()
    await renderHome()
    await user.type(screen.getByRole('textbox', { name: /What should I call you/ }), 'Sam{Enter}')
    expect(screen.getByRole('heading', { name: 'Your sound' })).toHaveFocus()
    expect(screen.getByText(tuneQuestion('Sam'))).toBeInTheDocument()
    expect(readIntro().name).toBe('Sam')
    const group = screen.getByRole('group', { name: 'Sound style' })
    expect(group.querySelectorAll('button')).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Nature Ambient' }))
    expect(JSON.parse(localStorage.getItem('earth-jukebox:audio-prefs') ?? '{}').style).toBe('nature')
    expect(screen.getByRole('button', { name: 'I can see the map' })).toBeInTheDocument()
  })

  it('does not ask again for a name the planet intro already has', async () => {
    saveIntro({ seen: true, name: 'Rae' })
    await renderHome()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText(tuneQuestion('Rae'))).toBeInTheDocument()
  })

  it('says the locked line when the welcome ends, and starts no tour on the other paths', async () => {
    const user = userEvent.setup()
    render(<AnnouncerProvider><HomePage visualization={visualization} /></AnnouncerProvider>)
    await screen.findByRole('region', { name: 'Welcome' })
    await user.type(screen.getByRole('textbox', { name: /What should I call you/ }), 'Sam{Enter}')
    await user.click(screen.getByRole('button', { name: 'Heavy Bass' }))
    await user.click(screen.getByRole('button', { name: 'I use a screen reader' }))
    await user.click(screen.getByRole('button', { name: 'Skip the sound check' }))
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain(lockedLine('Sam'))
    expect(readWelcome()).toMatchObject({ done: true, path: 'screen-reader' })
    expect(window.location.hash).toBe('#learn')
  })

  it('has no accessibility violations on the chat', async () => {
    const { container } = await renderHome()
    await expectNoA11yViolations(container)
  })
})

describe('manual setup', () => {
  it('swaps to a form, keeps what was typed when switching back, and saves name, style and path', async () => {
    const user = userEvent.setup()
    await renderHome()
    await user.type(screen.getByRole('textbox', { name: /What should I call you/ }), 'Sam')
    await user.click(screen.getByRole('button', { name: 'Prefer manual setup?' }))
    expect(screen.getByRole('heading', { name: 'Manual setup' })).toHaveFocus()
    const field = screen.getByRole('textbox', { name: /What should I call you/ })
    expect(field).toHaveValue('Sam')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Audio preference' }), 'Heavy Bass')
    await user.click(screen.getByRole('radio', { name: 'I use a screen reader' }))
    await user.click(screen.getByRole('button', { name: 'Chat with Echo instead' }))
    await user.click(screen.getByRole('button', { name: 'Prefer manual setup?' }))
    expect(screen.getByRole('combobox', { name: 'Audio preference' })).toHaveValue('bass')
    await user.click(screen.getByRole('button', { name: 'Save & Enter Jukebox' }))
    expect(readIntro().name).toBe('Sam')
    expect(JSON.parse(localStorage.getItem('earth-jukebox:audio-prefs') ?? '{}').style).toBe('bass')
    expect(readWelcome()).toMatchObject({ done: true, path: 'screen-reader', speech: false })
    expect(readDescriptionDetail()).toBe('concise')
    expect(window.location.hash).toBe('#learn')
  })

  it('starts the tour on the map path', async () => {
    const user = userEvent.setup()
    await renderHome()
    await user.click(screen.getByRole('button', { name: 'Prefer manual setup?' }))
    await user.click(screen.getByRole('button', { name: 'Save & Enter Jukebox' }))
    await waitFor(() => expect(getTour().active).toBe(true))
  })

  it('has no accessibility violations on the form', async () => {
    const user = userEvent.setup()
    const { container } = await renderHome()
    await user.click(screen.getByRole('button', { name: 'Prefer manual setup?' }))
    await expectNoA11yViolations(container)
  })
})

describe('the sound check', () => {
  async function toCheck(path: string) {
    const user = userEvent.setup()
    const view = await renderHome()
    await toPaths(user)
    await user.click(screen.getByRole('button', { name: path }))
    return { user, ...view }
  }

  it('moves focus to the sound check and plays nothing until Play is pressed', async () => {
    await toCheck('I can see the map')
    expect(screen.getByRole('heading', { name: 'Sound check' })).toHaveFocus()
    expect(fake.sequences).toHaveLength(0)
  })

  it('plays the note only after the spoken question has ended, and cannot be started twice (SN13)', async () => {
    const utterances: { text: string; onend?: () => void }[] = []
    vi.stubGlobal('speechSynthesis', { speak: (u: { text: string }) => utterances.push(u), cancel: vi.fn() })
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text } })
    const { user } = await toCheck('I can see the map')
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(utterances.at(-1)?.text).toMatch(/\?$/)
    expect(fake.sequences).toHaveLength(0) // no playSequence call while the question is spoken
    expect(screen.getByRole('button', { name: 'Replay' })).toBeDisabled()
    await act(async () => { utterances.at(-1)?.onend?.() })
    await waitFor(() => expect(fake.sequences).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Replay' })).toBeEnabled()
  })

  it('plays the note at once when speech is off', async () => {
    const { user } = await toCheck('I use a screen reader')
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(fake.sequences).toHaveLength(1))
  })

  it('plays one note, then left, right and centre at pans of -1, 1 and 0', async () => {
    const { user } = await toCheck('I use a screen reader')
    const play = async () => { await user.click(screen.getByRole('button', { name: /^(Play|Replay)$/ })) }
    // Yes is not available before the sound has been played.
    expect(screen.getByRole('button', { name: 'Yes' })).toBeDisabled()
    await play(); await user.click(screen.getByRole('button', { name: 'Yes' }))
    await play(); await user.click(screen.getByRole('button', { name: 'Yes' }))
    await play(); await user.click(screen.getByRole('button', { name: 'Yes' }))
    await play(); await user.click(screen.getByRole('button', { name: 'Yes' }))
    expect(pans()).toEqual([0, -1, 1, 0])
    expect(fake.unlocked).toBeGreaterThan(0)
    expect(screen.getByText('Is this volume comfortable?')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument()
  })

  it('says what to check after No, and lets the listener replay or carry on', async () => {
    const { user } = await toCheck('I can see the map')
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(screen.getByText(/headphones or speakers are on/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replay' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip the sound check' })).toBeInTheDocument()
  })

  it('has no accessibility violations on the check', async () => {
    const { container } = await toCheck('I can see the map')
    await expectNoA11yViolations(container)
  })
})

describe('the three paths', () => {
  async function throughCheck(path: string, volume?: number) {
    const { user } = await (async () => {
      const user = userEvent.setup()
      await renderHome()
      await toPaths(user)
      await user.click(screen.getByRole('button', { name: path }))
      return { user }
    })()
    if (volume === undefined) {
      await user.click(screen.getByRole('button', { name: 'Skip the sound check' }))
      return
    }
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: /^(Play|Replay)$/ }))
      await user.click(screen.getByRole('button', { name: 'Yes' }))
    }
    const slider = screen.getByRole('slider', { name: 'Volume' })
    fireEvent.change(slider, { target: { value: String(volume) } })
    await user.click(screen.getByRole('button', { name: 'Yes, this is comfortable' }))
  }

  it('"I use a screen reader": concise descriptions, no speech, on to Learn', async () => {
    const speakSpy = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak: speakSpy, cancel: vi.fn() })
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text } })
    await throughCheck('I use a screen reader')
    expect(window.location.hash).toBe('#learn')
    expect(readDescriptionDetail()).toBe('concise')
    expect(readWelcome()).toMatchObject({ done: true, path: 'screen-reader', speech: false })
    expect(speakSpy).not.toHaveBeenCalled()
  })

  it('"I can see the map": rich descriptions, the mascot may speak, on to Listen', async () => {
    const speakSpy = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak: speakSpy, cancel: vi.fn() })
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text } })
    localStorage.setItem('earth-jukebox:detail', 'concise')
    await throughCheck('I can see the map')
    expect(window.location.hash).toBe('#listen')
    expect(readDescriptionDetail()).toBe('rich')
    expect(readWelcome()).toMatchObject({ done: true, path: 'map', speech: true })
    expect(speakSpy).toHaveBeenCalled()
  })

  it('"Just play me something": on to Listen, then presses play until the player is going', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await throughCheck('Just play me something')
    expect(window.location.hash).toBe('#listen')
    await act(async () => { await vi.advanceTimersByTimeAsync(1300) })
    expect(commands.filter(command => command === 'play').length).toBeGreaterThanOrEqual(2)
    const before = commands.length
    publishContext('player', { playing: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(commands.length).toBe(before)
  })

  it('starts the guided tour after the map path only', async () => {
    await throughCheck('I can see the map')
    await waitFor(() => expect(getTour().active).toBe(true))
    expect(getTour().caption).toBe(TOUR_STEPS[0].say)
    act(() => stopTour())
    await waitFor(() => expect(getTour().active).toBe(false))

    for (const path of ['I use a screen reader', 'Just play me something']) {
      cleanup()
      resetWelcome()
      await throughCheck(path)
      expect(getTour().active).toBe(false)
    }
  })

  it('does not start the tour when the welcome is skipped', async () => {
    const user = userEvent.setup()
    await renderHome()
    await user.click(screen.getByRole('button', { name: 'Skip the welcome' }))
    expect(getTour().active).toBe(false)
  })

  it('remembers the volume chosen in the sound check', async () => {
    await throughCheck('I can see the map', 50)
    expect(readWelcome().volume).toBeCloseTo(0.5, 5)
    expect(fake.volumes).toContain(0.8)
  })
})

describe('what do you love listening to?', () => {
  async function toTaste() {
    const user = userEvent.setup()
    await renderHome()
    await toPaths(user)
    await user.click(screen.getByRole('button', { name: 'I can see the map' }))
    for (let i = 0; i < 4; i++) {
      await user.click(screen.getByRole('button', { name: /^(Play|Replay)$/ }))
      await user.click(screen.getByRole('button', { name: 'Yes' }))
    }
    return user
  }

  it('offers the five styles, the bass, the speed and the instruments, and remembers the choice', async () => {
    const user = await toTaste()
    expect(screen.getAllByRole('radio').map(radio => radio.getAttribute('name') && (radio.closest('label')?.textContent ?? ''))).toEqual([
      'The data set\'s own sound', 'Cinematic orchestral', '8-bit arcade', 'Lo-fi ambient', 'Heavy bass electronic', 'Organic nature',
    ])
    await user.click(screen.getByRole('radio', { name: 'Organic nature' }))
    expect(screen.getByText(/Wood, water and gentle percussion\./)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'rhythm' }))
    await user.click(screen.getByRole('button', { name: 'Fast' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Bass' }), { target: { value: '-2' } })
    expect(screen.getByRole('checkbox', { name: 'melody' })).toBeDisabled()
    expect(JSON.parse(localStorage.getItem('earth-jukebox:audio-prefs') ?? '{}')).toEqual({ style: 'nature', bassDb: -2, speed: 'fast', muted: ['rhythm'] })
  })

  it('plays a sample of the chosen style, or of the data set\'s own preset', async () => {
    const user = await toTaste()
    sample.played.length = 0
    await user.click(screen.getByRole('button', { name: 'Play sample' }))
    await user.click(screen.getByRole('radio', { name: '8-bit arcade' }))
    await user.click(screen.getByRole('button', { name: 'Play sample' }))
    expect(sample.played[1]).toBe('chiptune')
    expect(sample.played).toHaveLength(2)
  })

  it('has no accessibility violations', async () => {
    await toTaste()
    await expectNoA11yViolations(document.body)
  })
})

