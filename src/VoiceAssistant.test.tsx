// The voice guide panel (T51): states, Escape, the mute toggle, suggestion chips and the disabled input.
import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from './test/a11y'
import VoiceAssistant from './VoiceAssistant'
import type { useVoiceAssistant } from './hooks/useVoiceAssistant'

type Assistant = ReturnType<typeof useVoiceAssistant>

// jsdom has no layout, so elements have no scrollTo; the panel calls it to follow the conversation.
beforeAll(() => { Element.prototype.scrollTo ??= () => {} })

function fakeAssistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    status: 'idle', transcript: [], error: '', errorCode: '', endedMessage: '', actions: [], micMuted: false, level: 0, micSilent: false,
    start: vi.fn(async () => {}), stop: vi.fn(), stopSpeaking: vi.fn(), undo: vi.fn(), toggleMute: vi.fn(), sendText: vi.fn(() => true),
    ...overrides,
  } as Assistant
}

describe('VoiceAssistant panel', () => {
  it('opens with focus on its title and passes accessibility checks while idle', async () => {
    const { container } = render(<VoiceAssistant assistant={fakeAssistant()} onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Voice guide' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Start talking' })).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('closes on Escape from anywhere inside it', async () => {
    const onClose = vi.fn()
    render(<VoiceAssistant assistant={fakeAssistant()} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('explains why the question box is disabled while idle', () => {
    render(<VoiceAssistant assistant={fakeAssistant()} onClose={() => {}} />)
    const input = screen.getByRole('textbox', { name: 'Type a question instead' })
    expect(input).toBeDisabled()
    expect(input).toHaveAccessibleDescription('Start talking to type a question too.')
  })

  it('offers "Try again" after an error', () => {
    render(<VoiceAssistant assistant={fakeAssistant({ status: 'error', error: 'The connection dropped.' })} onClose={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('The connection dropped.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('has a mute toggle with one fixed label, pressed while muted', async () => {
    const assistant = fakeAssistant({ status: 'listening' })
    const { rerender, container } = render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    const mute = screen.getByRole('button', { name: 'Mute microphone' })
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(mute)
    expect(assistant.toggleMute).toHaveBeenCalledTimes(1)
    rerender(<VoiceAssistant assistant={{ ...assistant, micMuted: true }} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Mute microphone' })).toHaveAttribute('aria-pressed', 'true')
    await expectNoA11yViolations(container)
  })

  it('sends a suggested question when its chip is pressed, before the first message', async () => {
    const assistant = fakeAssistant({ status: 'listening' })
    render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    const chips = screen.getByRole('list', { name: 'Suggested questions' })
    expect(chips.querySelectorAll('button')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'What do the sounds mean?' }))
    expect(assistant.sendText).toHaveBeenCalledWith('What do the sounds mean?')
  })

  it('hides the chips once the conversation has started', () => {
    render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening', transcript: [{ id: 1, role: 'user', text: 'Hello' }] })} onClose={() => {}} />)
    expect(screen.queryByRole('list', { name: 'Suggested questions' })).toBeNull()
  })

  it('warns with a Notice when the microphone is silent', () => {
    render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening', micSilent: true })} onClose={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Warning: We cannot hear your microphone.')
  })

  it('links the privacy note to the About page', () => {
    render(<VoiceAssistant assistant={fakeAssistant()} onClose={() => {}} />)
    expect(screen.getByRole('link', { name: 'How we use AI' })).toHaveAttribute('href', '#about')
  })
})

describe('the mascot beside the panel', () => {
  const mascot = (container: HTMLElement) => container.querySelector('svg.voice-mascot')

  it('is there, hidden from screen readers, and the panel still passes accessibility checks', async () => {
    const { container } = render(<VoiceAssistant assistant={fakeAssistant()} onClose={() => {}} />)
    expect(mascot(container)).toHaveAttribute('aria-hidden', 'true')
    await expectNoA11yViolations(container)
  })

  it.each([
    ['idle', false, 'idle'],
    ['connecting', false, 'thinking'],
    ['listening', false, 'listening'],
    ['listening', true, 'idle'],
    ['speaking', false, 'talking'],
  ] as const)('takes its pose from the guide: %s (muted %s) is %s', (status, micMuted, pose) => {
    const { container } = render(<VoiceAssistant assistant={fakeAssistant({ status, micMuted })} onClose={() => {}} />)
    expect(mascot(container)).toHaveClass(`voice-mascot--${pose}`)
  })
})

describe('what Echo did (V01)', () => {
  const opened = { id: 1, label: 'Opened Listen', inverse: { action: 'navigate', page: 'home' } } as const

  it('lists the actions, with Undo on the newest one only, named after it', async () => {
    const assistant = fakeAssistant({
      status: 'listening',
      actions: [{ id: 0, label: 'Paused', inverse: { action: 'player', command: 'play' } }, opened],
    })
    const { container } = render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    const list = screen.getByRole('list', { name: 'Echo did' })
    expect(list.querySelectorAll('li')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^Undo/ })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Undo: Opened Listen' }))
    expect(assistant.undo).toHaveBeenCalledTimes(1)
    await expectNoA11yViolations(container)
  })

  it('says the newest action once in a polite live region', () => {
    render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening', actions: [opened] })} onClose={() => {}} />)
    const live = document.querySelector('[aria-live="polite"]')
    expect(live).toHaveTextContent('Opened Listen')
    expect(live).toHaveClass('ui-visually-hidden')
  })

  it('has no Undo for an entry with no inverse, such as "Stopped" or "Undid: ..."', () => {
    const { rerender } = render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening', actions: [{ id: 0, label: 'Stopped', inverse: null }] })} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull()
    rerender(<VoiceAssistant assistant={fakeAssistant({ status: 'listening', actions: [opened, { id: 2, label: 'Undid: Opened Listen', inverse: null }] })} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull()
    expect(within(screen.getByRole('list', { name: 'Echo did' })).getByText('Undid: Opened Listen')).toBeInTheDocument()
  })

  it('is not shown before the guide has done anything', () => {
    render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening' })} onClose={() => {}} />)
    expect(screen.queryByRole('list', { name: 'Echo did' })).toBeNull()
  })

  it('declares a target of at least 24 by 24 pixels for Undo', () => {
    const css = readFileSync('src/styles/assistant.css', 'utf8')
    const rule = /\.voice-assistant__undo\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(Number(/min-width:\s*(\d+)px/.exec(rule)?.[1])).toBeGreaterThanOrEqual(24)
    expect(Number(/min-height:\s*(\d+)px/.exec(rule)?.[1])).toBeGreaterThanOrEqual(24)
  })
})

describe('Stop talking (V01)', () => {
  it('shows only while the guide is speaking, and calls stopSpeaking', async () => {
    const assistant = fakeAssistant({ status: 'speaking' })
    const { rerender } = render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Stop talking' }))
    expect(assistant.stopSpeaking).toHaveBeenCalledTimes(1)
    rerender(<VoiceAssistant assistant={{ ...assistant, status: 'listening' }} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Stop talking' })).toBeNull()
    expect(screen.getByRole('button', { name: 'End conversation' })).toBeInTheDocument()
  })

  it('leaves Escape as the way to close, not a way to stop talking', async () => {
    const onClose = vi.fn()
    const assistant = fakeAssistant({ status: 'speaking' })
    render(<VoiceAssistant assistant={assistant} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(assistant.stopSpeaking).not.toHaveBeenCalled()
  })
})

describe('errors and the end of a conversation (V01)', () => {
  it('hides "Try again" when a retry cannot help', () => {
    const { rerender } = render(<VoiceAssistant assistant={fakeAssistant({ status: 'error', errorCode: 'not_configured', error: 'The voice guide is not set up.' })} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    rerender(<VoiceAssistant assistant={fakeAssistant({ status: 'error', errorCode: 'bad_start', error: 'x' })} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    rerender(<VoiceAssistant assistant={fakeAssistant({ status: 'error', errorCode: 'upstream', error: 'Echo stopped unexpectedly. The rest of the app still works.' })} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows the reason a conversation ended', () => {
    render(<VoiceAssistant assistant={fakeAssistant({ status: 'ended', endedMessage: 'This conversation reached its time limit. Start again to keep talking.' })} onClose={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('This conversation reached its time limit. Start again to keep talking.')
  })

  it('passes accessibility checks in the error state', async () => {
    const { container } = render(<VoiceAssistant assistant={fakeAssistant({ status: 'error', errorCode: 'upstream', error: 'Echo stopped unexpectedly. The rest of the app still works.' })} onClose={() => {}} />)
    await expectNoA11yViolations(container)
  })
})
