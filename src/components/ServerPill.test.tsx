import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HEALTH_LIMIT_MS } from '../hooks/useServerStatus'
import { WAKING_AFTER_MS } from '../hooks/useVoiceAssistant'
import { expectNoA11yViolations } from '../test/a11y'
import { AnnouncerContext } from './announcerContext'
import { ServerPill } from './ServerPill'

const announced: string[] = []
const show = () => render(<AnnouncerContext.Provider value={text => { announced.push(text) }}><ServerPill /></AnnouncerContext.Provider>)
const ok = () => Promise.resolve(new Response(JSON.stringify({ status: 'ok', agent: false }), { status: 200 }))

beforeEach(() => { announced.length = 0; vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('ServerPill', () => {
  it('says "Server ready" when the health check answers, and announces nothing', async () => {
    const fetchMock = vi.fn((_url: string) => ok())
    vi.stubGlobal('fetch', fetchMock)
    show()
    expect(screen.getByText('Checking server…')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('Server ready')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/health')
    expect(announced).toEqual([])
  })

  it('does not trust a page that answers every path with 200 but is not the health answer', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('<!doctype html>', { status: 200 }))))
    show()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('Server offline: the app still works')).toBeInTheDocument()
  })

  it('says "waking" after a slow answer, announces it, and says ready when it comes, without polling', async () => {
    let answer: (response: Response) => void = () => {}
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => { answer = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    show()
    await act(async () => { await vi.advanceTimersByTimeAsync(WAKING_AFTER_MS) })
    expect(screen.getByText('Server waking, this can take a minute')).toBeInTheDocument()
    expect(announced).toEqual(['Server waking, this can take a minute'])
    await act(async () => { answer(new Response(JSON.stringify({ status: 'ok' }), { status: 200 })); await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('Server ready')).toBeInTheDocument()
    expect(announced.at(-1)).toBe('Server ready')
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('goes offline when the request fails, announces it, and "Check again" asks again', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockImplementation(ok)
    vi.stubGlobal('fetch', fetchMock)
    show()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('Server offline: the app still works')).toBeInTheDocument()
    expect(announced).toEqual(['Server offline: the app still works'])

    await act(async () => { screen.getByRole('button', { name: 'Check again' }).click(); await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByText('Server ready')).toBeInTheDocument()
    expect(announced.at(-1)).toBe('Server ready')
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after the limit, as offline', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    show()
    await act(async () => { await vi.advanceTimersByTimeAsync(HEALTH_LIMIT_MS) })
    expect(screen.getByText('Server offline: the app still works')).toBeInTheDocument()
  })

  it('stops quietly when it leaves the page before the answer', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const { unmount } = show()
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(HEALTH_LIMIT_MS) })
    expect(announced).toEqual([])
  })
})

// axe uses timers of its own, so these run on real ones.
describe('ServerPill: accessibility', () => {
  beforeEach(() => vi.useRealTimers())

  it.each([
    ['ready', ok, 'Server ready'],
    ['offline', () => Promise.reject(new TypeError('Failed to fetch')), 'Server offline: the app still works'],
  ])('has no violations when %s', async (_name, answer, text) => {
    vi.stubGlobal('fetch', vi.fn(answer))
    const { container } = show()
    await screen.findByText(text)
    await expectNoA11yViolations(container)
  })
})
