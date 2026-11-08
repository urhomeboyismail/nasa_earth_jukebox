// The voice guide panel (T51): states, Escape, the mute toggle, suggestion chips and the disabled input.
import { render, screen } from '@testing-library/react'
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
    status: 'idle', transcript: [], error: '', micMuted: false, level: 0, micSilent: false,
    start: vi.fn(async () => {}), stop: vi.fn(), toggleMute: vi.fn(), sendText: vi.fn(() => true),
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
