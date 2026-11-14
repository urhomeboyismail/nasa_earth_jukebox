import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { forgetKeptValues } from './hooks/useStoredValue'
import type { useVoiceAssistant } from './hooks/useVoiceAssistant'
import { expectNoA11yViolations } from './test/a11y'
import { FakeRecognition } from './test/fakes'
import VoiceAssistant from './VoiceAssistant'

type Assistant = ReturnType<typeof useVoiceAssistant>
const assistant: Assistant = {
  status: 'idle', transcript: [], error: '', errorCode: '', endedMessage: '', actions: [], micMuted: false, micSilent: false,
  micNote: '', micReady: true, levelRef: { current: 0 }, consent: 'mic', consentAsked: false, talkMode: 'open', talking: false,
  answerLength: 'short', limitWarning: false, waking: false,
  start: vi.fn(), stop: vi.fn(), stopSpeaking: vi.fn(), undo: vi.fn(), toggleMute: vi.fn(), toggleTalk: vi.fn(), sendText: vi.fn(() => true),
  chooseConsent: vi.fn(), clearConsent: vi.fn(), continueSession: vi.fn(), setTalkMode: vi.fn(), setAnswerLength: vi.fn(),
}

// jsdom has no layout, so elements have no scrollTo; the panel calls it to follow the conversation.
beforeAll(() => { Element.prototype.scrollTo ??= () => {} })
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); forgetKeptValues() })

describe('VoiceAssistant: the "Hey Echo" switch', () => {
  it('is offered where the browser can listen, off at first, says where the sound goes, and keeps the choice', async () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    const { container } = render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    const box = screen.getByRole('checkbox', { name: 'Answer to “Hey Echo”' })
    expect(box).not.toBeChecked()
    expect(box).toHaveAccessibleDescription(/browser maker's speech service.*Nothing reaches Echo until you say it/)
    await userEvent.click(box)
    expect(box).toBeChecked()
    expect(localStorage.getItem('earth-jukebox:wake-word')).toBe('on')
    await expectNoA11yViolations(container)
  })

  it('is not offered where the browser has no speech recognition', () => {
    render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    expect(screen.queryByRole('checkbox', { name: 'Answer to “Hey Echo”' })).toBeNull()
  })
})
