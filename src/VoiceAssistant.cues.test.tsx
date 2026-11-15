import { render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import VoiceAssistant from './VoiceAssistant'
import type { useVoiceAssistant } from './hooks/useVoiceAssistant'

const playCue = vi.hoisted(() => vi.fn())
vi.mock('./audio/cues', () => ({ playCue }))

type Assistant = ReturnType<typeof useVoiceAssistant>
const assistant = (status: Assistant['status']): Assistant => ({
  status, transcript: [], error: status === 'error' ? 'The connection dropped.' : '', errorCode: '', endedMessage: '', actions: [], liveAnswer: null, micMuted: false,
  micSilent: false, micNote: '', micReady: true, levelRef: { current: 0 }, consent: 'mic', consentAsked: false, talkMode: 'open', talking: false,
  answerLength: 'short', limitWarning: false, waking: false,
  start: vi.fn(), stop: vi.fn(), stopSpeaking: vi.fn(), undo: vi.fn(), toggleMute: vi.fn(), toggleTalk: vi.fn(), sendText: vi.fn(() => true),
  chooseConsent: vi.fn(), clearConsent: vi.fn(), continueSession: vi.fn(), setTalkMode: vi.fn(), setAnswerLength: vi.fn(),
})

// jsdom has no layout, so elements have no scrollTo; the panel calls it to follow the conversation.
beforeAll(() => { Element.prototype.scrollTo ??= () => {} })
afterEach(() => { playCue.mockClear() })

describe('VoiceAssistant: interface sounds', () => {
  it('plays one cue when the guide connects and one when it ends, and none for turn taking', () => {
    const view = render(<VoiceAssistant assistant={assistant('idle')} onClose={() => {}} />)
    const to = (status: Assistant['status']) => view.rerender(<VoiceAssistant assistant={assistant(status)} onClose={() => {}} />)
    to('connecting')
    expect(playCue).not.toHaveBeenCalled()
    to('listening')
    to('speaking')
    to('listening')
    expect(playCue.mock.calls).toEqual([['connected']])
    to('ended')
    expect(playCue.mock.calls).toEqual([['connected'], ['ended']])
  })

  it('plays the error cue when the connection fails', () => {
    render(<VoiceAssistant assistant={assistant('error')} onClose={() => {}} />)
    expect(playCue.mock.calls).toEqual([['error']])
  })
})
