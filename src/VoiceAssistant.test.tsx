// The voice guide panel (T51): states, Escape, the mute toggle, suggestion chips and the disabled input.
import { readFileSync } from 'node:fs'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from './test/a11y'
import { installFakeAudioContext } from './test/fakes'
import VoiceAssistant from './VoiceAssistant'
import { useVoiceAssistant } from './hooks/useVoiceAssistant'

type Assistant = ReturnType<typeof useVoiceAssistant>

// jsdom has no layout, so elements have no scrollTo; the panel calls it to follow the conversation.
beforeAll(() => { Element.prototype.scrollTo ??= () => {} })

// The defaults are a decided open mic, as the guide was before V02, so the older cases keep their meaning.
function fakeAssistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    status: 'idle', transcript: [], error: '', errorCode: '', endedMessage: '', actions: [], micMuted: false, micSilent: false,
    micNote: '', micReady: true, levelRef: { current: 0 }, consent: 'mic', consentAsked: false, talkMode: 'open', talking: false,
    answerLength: 'short', limitWarning: false, waking: false,
    start: vi.fn(), stop: vi.fn(), stopSpeaking: vi.fn(), undo: vi.fn(), toggleMute: vi.fn(), toggleTalk: vi.fn(), sendText: vi.fn(() => true),
    chooseConsent: vi.fn(), clearConsent: vi.fn(), continueSession: vi.fn(), setTalkMode: vi.fn(), setAnswerLength: vi.fn(),
    ...overrides,
  }
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

// ---- V02: the panel with the real hook, a fake socket and a stubbed getUserMedia --------------------------------

class FakeSocket {
  static OPEN = 1
  static instances: FakeSocket[] = []
  readyState = 1
  binaryType = ''
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  sent: unknown[] = []
  constructor() { FakeSocket.instances.push(this) }
  send(data: unknown) { this.sent.push(data) }
  close() {}
}

function LivePanel() {
  const assistant = useVoiceAssistant({ language: 'en', page: 'home', onAction: () => {} })
  return <VoiceAssistant assistant={assistant} onClose={() => {}} />
}

const socket = () => FakeSocket.instances[FakeSocket.instances.length - 1]
function serverReady() {
  act(() => socket().onopen?.())
  act(() => socket().onmessage?.({ data: JSON.stringify({ type: 'ready' }) }))
}
const sentTexts = () => socket().sent.filter((item): item is string => typeof item === 'string').map(item => JSON.parse(item) as Record<string, unknown>)

describe('microphone consent (V02)', () => {
  let getUserMedia: ReturnType<typeof vi.fn>
  beforeEach(() => {
    FakeSocket.instances = []
    vi.stubGlobal('WebSocket', FakeSocket)
    installFakeAudioContext()
    getUserMedia = vi.fn(async () => { throw new DOMException('Permission denied', 'NotAllowedError') })
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'mediaDevices')
    localStorage.clear()
  })

  it('shows the card on the first Start, before any microphone prompt, and passes accessibility checks', async () => {
    const { container } = render(<LivePanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Start talking' }))
    const card = screen.getByRole('region', { name: 'Use your microphone?' })
    expect(card).toHaveTextContent("your voice and what you type are sent to Google's Gemini")
    expect(screen.getByRole('heading', { name: 'Use your microphone?' })).toHaveFocus()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(FakeSocket.instances).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Start talking' })).toBeNull()
    await expectNoA11yViolations(container)
  })

  it('"Allow microphone" stores "mic", then asks for the microphone once', async () => {
    render(<LivePanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Start talking' }))
    expect(getUserMedia).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Allow microphone' }))
    expect(localStorage.getItem('earth-jukebox:mic-consent')).toBe('mic')
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'Use your microphone?' })).toBeNull()
  })

  it('"Use text only" stores "text", starts a conversation without the microphone, and typing sends a text message', async () => {
    render(<LivePanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Start talking' }))
    await userEvent.click(screen.getByRole('button', { name: 'Use text only' }))
    expect(localStorage.getItem('earth-jukebox:mic-consent')).toBe('text')
    expect(FakeSocket.instances).toHaveLength(1)
    serverReady()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Talk' })).toBeNull()
    await userEvent.type(screen.getByRole('textbox', { name: 'Type a question instead' }), 'What is this?{Enter}')
    expect(sentTexts()).toContainEqual({ type: 'text', text: 'What is this?' })
  })

  it('gives both choices the same class names, so neither looks like the default', async () => {
    render(<LivePanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Start talking' }))
    const allow = screen.getByRole('button', { name: 'Allow microphone' })
    const text = screen.getByRole('button', { name: 'Use text only' })
    expect(allow.className).toBe(text.className)
    expect(allow.className).not.toMatch(/ui-button--(medium|large)/)
  })

  it('keeps the conversation open after a refused microphone, with the note, and typing works', async () => {
    render(<LivePanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Start talking' }))
    await userEvent.click(screen.getByRole('button', { name: 'Allow microphone' }))
    serverReady()
    expect(await screen.findByText('Echo cannot use the microphone. You can type your questions.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'End conversation' })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Type a question instead' }), 'Hello{Enter}')
    expect(sentTexts()).toContainEqual({ type: 'text', text: 'Hello' })
  })

  it('stores "Keep the microphone open" as open or push', async () => {
    render(<LivePanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Start talking' }))
    const open = screen.getByRole('checkbox', { name: 'Keep the microphone open' })
    expect(open).not.toBeChecked()
    await userEvent.click(open)
    expect(localStorage.getItem('earth-jukebox:mic-talk')).toBe('open')
    await userEvent.click(open)
    expect(localStorage.getItem('earth-jukebox:mic-talk')).toBe('push')
  })

  it('"Change microphone choice" forgets the choice and shows the card again', async () => {
    localStorage.setItem('earth-jukebox:mic-consent', 'text')
    render(<LivePanel />)
    expect(screen.getByRole('button', { name: 'Start typing' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Change microphone choice' }))
    expect(localStorage.getItem('earth-jukebox:mic-consent')).toBeNull()
    expect(screen.getByRole('region', { name: 'Use your microphone?' })).toBeInTheDocument()
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('works with blocked storage: the card shows and the choice holds for this visit only', async () => {
    const blocked = () => { throw new DOMException('blocked', 'SecurityError') }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)
    render(<LivePanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Start talking' }))
    await userEvent.click(screen.getByRole('button', { name: 'Use text only' }))
    expect(FakeSocket.instances).toHaveLength(1)
    vi.restoreAllMocks()
    expect(localStorage.getItem('earth-jukebox:mic-consent')).toBeNull()
  })
})

describe('talking, answers, the time limit and waking (V02)', () => {
  it('has Talk under push-to-talk, one fixed name, pressed while sending', async () => {
    const assistant = fakeAssistant({ status: 'listening', talkMode: 'push' })
    const { rerender, container } = render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Mute microphone' })).toBeNull()
    const talk = screen.getByRole('button', { name: 'Talk' })
    expect(talk).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Press Talk to speak, or type a question below.')).toHaveClass('voice-assistant__status')
    await userEvent.click(talk)
    expect(assistant.toggleTalk).toHaveBeenCalledTimes(1)
    rerender(<VoiceAssistant assistant={{ ...assistant, talking: true }} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Talk' })).toHaveAttribute('aria-pressed', 'true')
    await expectNoA11yViolations(container)
  })

  it('shows no microphone button in a text-only conversation', () => {
    render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening', consent: 'text', micReady: false })} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Talk' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mute microphone' })).toBeNull()
    expect(screen.getByText('Ready. Type a question below.')).toHaveClass('voice-assistant__status')
  })

  it('offers Short and Detailed answers, Short by default, and says a change applies next time', async () => {
    const assistant = fakeAssistant({ status: 'listening' })
    render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    const group = screen.getByRole('group', { name: 'Answers' })
    expect(within(group).getByRole('radio', { name: 'Short' })).toBeChecked()
    await userEvent.click(within(group).getByRole('radio', { name: 'Detailed' }))
    expect(assistant.setAnswerLength).toHaveBeenCalledWith('detailed')
    expect(screen.getByText('A change to Answers applies to the next conversation.')).toBeInTheDocument()
  })

  it('warns a minute before the limit, and Continue calls continueSession; passes accessibility checks', async () => {
    const assistant = fakeAssistant({ status: 'listening', limitWarning: true, transcript: [{ id: 1, role: 'assistant', text: 'Hello.' }] })
    const { container } = render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Warning: Echo will stop in 1 minute. Continue?')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(assistant.continueSession).toHaveBeenCalledTimes(1)
    await expectNoA11yViolations(container)
  })

  it('says Echo is waking up only once the hook says so', () => {
    const { rerender } = render(<VoiceAssistant assistant={fakeAssistant({ status: 'connecting' })} onClose={() => {}} />)
    expect(screen.queryByText('Waking Echo up, this can take a minute.')).toBeNull()
    rerender(<VoiceAssistant assistant={fakeAssistant({ status: 'connecting', waking: true })} onClose={() => {}} />)
    expect(screen.getByText('Waking Echo up, this can take a minute.')).toBeInTheDocument()
  })

  it('draws the meter from the level ref without a re-render, and hides it while muted', async () => {
    const levelRef = { current: 0.1 }
    const assistant = fakeAssistant({ status: 'listening', levelRef })
    const { container, rerender } = render(<VoiceAssistant assistant={assistant} onClose={() => {}} />)
    const meter = () => container.querySelector<HTMLElement>('.voice-assistant__meter')
    await waitFor(() => expect(meter()?.style.getPropertyValue('--level')).toBe('0.4'))
    levelRef.current = 0.2
    await waitFor(() => expect(meter()?.style.getPropertyValue('--level')).toBe('0.8'))
    rerender(<VoiceAssistant assistant={{ ...assistant, micMuted: true }} onClose={() => {}} />)
    expect(meter()).toBeNull()
  })

  it('passes accessibility checks in a session', async () => {
    const { container } = render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening', micNote: 'Echo cannot use the microphone. You can type your questions.', micReady: false })} onClose={() => {}} />)
    await expectNoA11yViolations(container)
  })
})

// ---- V03: a quieter status, shared icons, checked messages --------------------------------------------------------

describe('the status line and its announcement (V03)', () => {
  const visible = (container: HTMLElement) => container.querySelector('.voice-assistant__status')!
  const announced = () => screen.getByRole('status')

  it.each([
    ['listening', { micReady: true, talkMode: 'open' as const }, 'Listening. Speak any time.'],
    ['listening', { micReady: true, talkMode: 'open' as const, micMuted: true }, 'Microphone off. Type a question below.'],
    ['listening', { micReady: false }, 'Ready. Type a question below.'],
    ['speaking', { micReady: true, talkMode: 'open' as const }, 'Speaking. Talk to interrupt.'],
    ['connecting', {}, 'Connecting...'],
    ['error', { error: 'Echo could not connect.' }, 'Echo could not connect.'],
    ['ended', { endedMessage: 'The conversation has ended.' }, 'The conversation has ended.'],
  ] as const)('keeps the visible text for %s (%s)', (status, extra, text) => {
    const { container } = render(<VoiceAssistant assistant={fakeAssistant({ status, ...extra })} onClose={() => {}} />)
    expect(visible(container)).toHaveTextContent(text)
  })

  it('gives the visible status line no role', () => {
    const { container } = render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening' })} onClose={() => {}} />)
    expect(visible(container)).not.toHaveAttribute('role')
  })

  it('announces connecting, error and ended, and nothing for listening and speaking', () => {
    const cases: [Assistant['status'], Partial<Assistant>, string][] = [
      ['connecting', {}, 'Connecting...'],
      ['error', { error: 'Echo stopped unexpectedly.' }, 'Echo stopped unexpectedly.'],
      ['ended', { endedMessage: 'The conversation has ended.' }, 'The conversation has ended.'],
      ['listening', {}, ''],
      ['speaking', {}, ''],
    ]
    for (const [status, extra, text] of cases) {
      const { unmount } = render(<VoiceAssistant assistant={fakeAssistant({ status, ...extra })} onClose={() => {}} />)
      expect(announced()).toHaveTextContent(text, { normalizeWhitespace: true })
      if (!text) expect(announced()).toBeEmptyDOMElement()
      unmount()
    }
  })

  it('draws its icons through the shared component, and the close button keeps its name', () => {
    const { container } = render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening' })} onClose={() => {}} />)
    const icons = container.querySelectorAll('svg.voice-assistant__icon')
    expect(icons.length).toBeGreaterThan(0)
    icons.forEach(icon => expect(icon).toHaveAttribute('aria-hidden', 'true'))
    expect(screen.getByRole('button', { name: 'Close voice guide' })).toBeInTheDocument()
  })

  it('passes accessibility checks while listening', async () => {
    const { container } = render(<VoiceAssistant assistant={fakeAssistant({ status: 'listening' })} onClose={() => {}} />)
    await expectNoA11yViolations(container)
  })

  it('leaves no inline icon table or stale comment in the source', () => {
    const source = readFileSync('src/VoiceAssistant.tsx', 'utf8')
    expect(source).not.toContain('const icons')
    expect(source).not.toContain('T50')
  })
})

describe('server messages are checked before use (V03)', () => {
  beforeEach(() => {
    FakeSocket.instances = []
    vi.stubGlobal('WebSocket', FakeSocket)
    installFakeAudioContext()
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('ignores a transcript with an unknown role', async () => {
    render(<LivePanel />)
    await userEvent.click(screen.getByRole('button', { name: /Start (talking|typing)/ }))
    const text = screen.queryByRole('button', { name: 'Use text only' })
    if (text) await userEvent.click(text)
    serverReady()
    act(() => socket().onmessage?.({ data: JSON.stringify({ type: 'transcript', role: 'system', text: 'Hidden line' }) }))
    act(() => socket().onmessage?.({ data: JSON.stringify({ type: 'transcript', role: 'assistant', text: 'Shown line' }) }))
    expect(screen.queryByText(/Hidden line/)).toBeNull()
    expect(screen.getByText(/Shown line/)).toBeInTheDocument()
  })
})
