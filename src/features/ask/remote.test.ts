import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Fact } from './facts'
import { AGENT_TIMEOUT_MS, askAgent, WORKING_AFTER_MS } from './remote'

const facts: Fact[] = [
  { id: 'F-first', kind: 'data', text: 'On 1 January the value was about 10.0.' },
  { id: 'F-last', kind: 'data', text: 'On 4 January the value was about 30.0.' },
  { id: 'F-source', kind: 'text', text: 'The images come from a test source.' },
]
const knownDates = ['2024-01-01', '2024-01-02']
const input = { question: 'is the sea getting saltier', facts, knownDates }

const reply = (body: unknown, status = 200) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })))

/** A server that never answers, but gives up when the request is aborted, as a real fetch does. */
const hanging = () =>
  vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('askAgent', () => {
  it('sends the question, the facts and the dates, and returns the chosen IDs and the mapped action', async () => {
    const fetch = reply({ factIds: ['F-first', 'F-last'], confidence: 'high', action: { kind: 'navigate', page: 'compare' } })
    vi.stubGlobal('fetch', fetch)
    const answer = await askAgent(input, { onSlow: vi.fn() })
    expect(answer).toEqual({ factIds: ['F-first', 'F-last'], confidence: 'high', action: { action: 'navigate', page: 'compare' } })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/agent/ask')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(init.body))).toEqual({ question: input.question, facts, knownDates })
  })

  it('maps a date action to a player command', async () => {
    vi.stubGlobal('fetch', reply({ factIds: ['F-first'], confidence: 'medium', action: { kind: 'set_date', date: '2024-01-02' } }))
    const answer = await askAgent(input, { onSlow: vi.fn() })
    expect(answer?.action).toEqual({ action: 'player', command: { setDate: '2024-01-02' } })
  })

  it('keeps only the IDs that were sent, and answers nothing when none are left', async () => {
    vi.stubGlobal('fetch', reply({ factIds: ['F-made-up', 'F-other'], confidence: 'high', action: { kind: 'navigate', page: 'listen' } }))
    expect(await askAgent(input, { onSlow: vi.fn() })).toEqual({ factIds: [], confidence: 'none', action: null })

    vi.stubGlobal('fetch', reply({ factIds: ['F-made-up', 'F-last'], confidence: 'high' }))
    expect(await askAgent(input, { onSlow: vi.fn() })).toEqual({ factIds: ['F-last'], confidence: 'high', action: null })
  })

  it.each([404, 503, 429])('gives null for a %i', async status => {
    vi.stubGlobal('fetch', reply({ factIds: ['F-first'], confidence: 'high' }, status))
    expect(await askAgent(input, { onSlow: vi.fn() })).toBeNull()
  })

  it('gives null for a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await askAgent(input, { onSlow: vi.fn() })).toBeNull()
  })

  it.each([
    ['not JSON', 'Internal error'],
    ['no IDs', JSON.stringify({ confidence: 'high' })],
    ['an unknown confidence', JSON.stringify({ factIds: ['F-first'], confidence: 'certain' })],
    ['IDs that are not text', JSON.stringify({ factIds: [1, 2], confidence: 'high' })],
    ['an unknown action', JSON.stringify({ factIds: ['F-first'], confidence: 'high', action: { kind: 'delete_everything' } })],
  ])('gives null for a body with %s', async (_name, body) => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(body, { status: 200 }))))
    expect(await askAgent(input, { onSlow: vi.fn() })).toBeNull()
  })

  it('says it is slow at 1 s and gives up with null at 2.5 s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hanging())
    const onSlow = vi.fn()
    let settled = false
    const pending = askAgent(input, { onSlow }).finally(() => { settled = true })

    await vi.advanceTimersByTimeAsync(WORKING_AFTER_MS - 1)
    expect(onSlow).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onSlow).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(AGENT_TIMEOUT_MS - WORKING_AFTER_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('gives null when the caller aborts, and does not call onSlow afterwards', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hanging())
    const onSlow = vi.fn()
    const controller = new AbortController()
    const pending = askAgent(input, { onSlow, signal: controller.signal })
    controller.abort()
    expect(await pending).toBeNull()
    await vi.advanceTimersByTimeAsync(AGENT_TIMEOUT_MS)
    expect(onSlow).not.toHaveBeenCalled()
  })

  it.each([
    ['an unknown page', { kind: 'navigate', page: 'admin' }],
    ['a navigate with no page', { kind: 'navigate', page: null }],
    ['a date that is not a real date', { kind: 'set_date', date: '2024-02-31' }],
    ['a date in another format', { kind: 'set_date', date: '1 Jan 2024' }],
    ['a date the data set does not have', { kind: 'set_date', date: '1999-01-01' }],
  ])('drops %s but keeps the answer', async (_name, action) => {
    vi.stubGlobal('fetch', reply({ factIds: ['F-first'], confidence: 'high', action }))
    expect(await askAgent(input, { onSlow: vi.fn() })).toEqual({ factIds: ['F-first'], confidence: 'high', action: null })
  })
})
