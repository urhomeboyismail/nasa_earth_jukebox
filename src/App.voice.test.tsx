// The voice guide's playback actions reach the player through App.
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import catalog from '../public/data/index.json'
import fixture from '../public/data/fixture/manifest.json'
import App from './App'
import { resetDucking } from './assistant/ducking'
import { DUCK_LINEAR, duck } from './audio/duck'
import { onPlayerCommand, type PlayerCommand } from './features/player/controls'
import type { AssistantAction } from './hooks/useVoiceAssistant'

const guide = vi.hoisted(() => ({ onAction: null as null | ((action: unknown) => void), status: 'idle' as string }))
vi.mock('./hooks/useVoiceAssistant', async importOriginal => ({
  ...(await importOriginal<typeof import('./hooks/useVoiceAssistant')>()),
  useVoiceAssistant: ({ onAction }: { onAction: (action: unknown) => void }) => {
    guide.onAction = onAction
    return { status: guide.status, transcript: [], error: '', micMuted: false, level: 0, micSilent: false, start: vi.fn(), stop: vi.fn(), toggleMute: vi.fn(), sendText: vi.fn() }
  },
}))
vi.mock('./analysis', () => ({ analyzeAll: async () => [] }))

let received: PlayerCommand[]
let unsubscribe: () => void

beforeEach(() => {
  resetDucking()
  guide.status = 'idle'
  received = []
  unsubscribe = onPlayerCommand(command => received.push(command))
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.endsWith('/data/index.json') ? catalog : url.endsWith('/data/fixture/manifest.json') ? fixture : null
    return new Response(JSON.stringify(body), { status: body ? 200 : 404 })
  }))
})
afterEach(() => { unsubscribe(); vi.unstubAllGlobals() })

describe('voice guide playback actions', () => {
  it('passes a player action to sendPlayerCommand', () => {
    render(<App />)
    guide.onAction!({ action: 'player', command: 'pause' } satisfies AssistantAction)
    guide.onAction!({ action: 'player', command: { setDate: '2024-07-15' } } satisfies AssistantAction)
    expect(received).toEqual(['pause', { setDate: '2024-07-15' }])
  })

  it('ducks the music, and does not pause the player, while the guide is listening', () => {
    guide.status = 'listening'
    render(<App />)
    expect(received).toEqual([])
    expect(duck.target()).toBe(DUCK_LINEAR)
  })

  it('leaves the player alone while the guide is closed', () => {
    render(<App />)
    expect(received).toEqual([])
  })
})
