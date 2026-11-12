import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiBase, socketUrl } from './config'

afterEach(() => vi.unstubAllEnvs())

describe('apiBase', () => {
  it('trims spaces and trailing slashes', () => {
    vi.stubEnv('VITE_API_URL', ' https://x.example/// ')
    expect(apiBase()).toBe('https://x.example')
  })
  it('is empty when not set', () => {
    vi.stubEnv('VITE_API_URL', '')
    expect(apiBase()).toBe('')
  })
})

describe('socketUrl', () => {
  it('uses wss for an https API host', () => {
    vi.stubEnv('VITE_API_URL', 'https://x.example')
    expect(socketUrl('/api/v1/assistant/live')).toBe('wss://x.example/api/v1/assistant/live')
  })
  it('uses ws for an http API host', () => {
    vi.stubEnv('VITE_API_URL', 'http://x.example')
    expect(socketUrl('/api/v1/assistant/live')).toBe('ws://x.example/api/v1/assistant/live')
  })
  it('falls back to the host of this page with an empty base', () => {
    vi.stubEnv('VITE_API_URL', '')
    const url = new URL(socketUrl('/live'))
    expect(url.host).toBe(window.location.host)
    expect(url.protocol).toBe(window.location.protocol === 'https:' ? 'wss:' : 'ws:')
    expect(url.pathname).toBe('/live')
  })
})
