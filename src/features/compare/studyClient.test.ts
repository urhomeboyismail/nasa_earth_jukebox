import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StudyClient, type StudyAnswer } from './studyClient'

const SESSION = { participant: 'blind_low_vision', screenReader: true, sawImages: false } as const
const answer = (n: number, extra: Partial<StudyAnswer> = {}): StudyAnswer => ({ comparisonId: `c${n}`, answer: 'b', correct: true, responseMs: 1000 + n, ...extra })

type Reply = Response | Error
/** A fetch that answers from a script, one reply per call, and records the calls. */
function scripted(replies: Reply[], fallback: () => Reply) {
  const calls: { url: string; body: any }[] = []
  const fn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
    const reply = replies.shift() ?? fallback()
    if (reply instanceof Error) throw reply
    return reply
  })
  return { fn: fn as unknown as typeof fetch, calls }
}
const created = () => new Response(JSON.stringify({ id: 'abc' }), { status: 201 })
const stored = () => new Response(null, { status: 204 })
const refused = (status: number) => new Response('{}', { status })
const offline = () => new TypeError('Failed to fetch')

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('StudyClient', () => {
  it('creates the session, then posts each answer in order', async () => {
    const { fn, calls } = scripted([created()], stored)
    const client = new StudyClient({ fetch: fn })
    client.start(SESSION)
    client.submit(answer(1, { confidence: 4, comment: 'clear' }))
    client.submit(answer(2))
    await client.flush()
    expect(calls.map(c => c.url)).toEqual(['/api/v1/tests', '/api/v1/tests/abc/responses', '/api/v1/tests/abc/responses'])
    expect(calls[0].body).toEqual({ participant: 'blind_low_vision', screenReader: true, sawImages: false, consent: true })
    expect(calls[1].body).toEqual({ comparisonId: 'c1', answer: 'b', correct: true, responseMs: 1001, confidence: 4, comment: 'clear' })
    expect(calls[2].body.comparisonId).toBe('c2')
    expect(client.status).toMatchObject({ total: 2, sent: 2, pending: 0, rejected: 0, problem: '' })
  })

  it('holds an answer given before the session exists, and sends it once it does', async () => {
    const { fn, calls } = scripted([created()], stored)
    const client = new StudyClient({ fetch: fn })
    client.submit(answer(1))
    expect(client.status.pending).toBe(1)
    expect(calls).toHaveLength(0)
    client.start(SESSION)
    await client.flush()
    expect(client.status).toMatchObject({ sent: 1, pending: 0 })
  })

  it('keeps an answer in memory when the network fails and retries it', async () => {
    const { fn, calls } = scripted([created(), offline(), offline()], stored)
    const client = new StudyClient({ fetch: fn, retryDelaysMs: [1000, 2000] })
    client.start(SESSION)
    client.submit(answer(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(client.status).toMatchObject({ sent: 0, pending: 1 })
    expect(client.status.problem).toMatch(/No connection/)

    await vi.advanceTimersByTimeAsync(999)
    expect(calls).toHaveLength(2) // still waiting for the first retry
    await vi.advanceTimersByTimeAsync(1)
    expect(client.status.pending).toBe(1) // that retry failed too
    await vi.advanceTimersByTimeAsync(2000)
    expect(client.status).toMatchObject({ sent: 1, pending: 0, problem: '' })
    expect(calls.filter(c => c.url.endsWith('/responses')).map(c => c.body.comparisonId)).toEqual(['c1', 'c1', 'c1'])
  })

  it('keeps retrying when the session itself cannot be created', async () => {
    const { fn } = scripted([offline(), refused(503)], () => created())
    const client = new StudyClient({ fetch: fn, retryDelaysMs: [500] })
    client.start(SESSION)
    client.submit(answer(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(client.status.problem).toMatch(/No connection/)
    await vi.advanceTimersByTimeAsync(500)
    expect(client.status.problem).toMatch(/could not start the test \(error 503\)/)
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.status).toMatchObject({ sent: 1, pending: 0 })
  })

  it('keeps the order of answers across a failure', async () => {
    const { fn, calls } = scripted([created(), stored(), offline()], stored)
    const client = new StudyClient({ fetch: fn, retryDelaysMs: [100] })
    client.start(SESSION)
    client.submit(answer(1))
    client.submit(answer(2))
    client.submit(answer(3))
    await vi.advanceTimersByTimeAsync(500)
    expect(calls.filter(c => c.url.endsWith('/responses')).map(c => c.body.comparisonId)).toEqual(['c1', 'c2', 'c2', 'c3'])
    expect(client.status.sent).toBe(3)
  })

  it('keeps an answer the server refuses for good, instead of retrying forever or dropping it', async () => {
    const { fn, calls } = scripted([created(), refused(422)], stored)
    const client = new StudyClient({ fetch: fn })
    client.start(SESSION)
    client.submit(answer(1))
    client.submit(answer(2))
    await client.flush()
    expect(client.status).toMatchObject({ sent: 1, pending: 0, rejected: 1, total: 2 })
    expect(client.rejectedAnswers.map(a => a.comparisonId)).toEqual(['c1'])
    expect(calls.filter(c => c.body.comparisonId === 'c1')).toHaveLength(1)
  })

  it('starts a new session and resends when the server has forgotten the old one', async () => {
    const { fn, calls } = scripted([created(), refused(404), new Response(JSON.stringify({ id: 'xyz' }), { status: 201 })], stored)
    const client = new StudyClient({ fetch: fn, retryDelaysMs: [100] })
    client.start(SESSION)
    client.submit(answer(1))
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls.map(c => c.url)).toEqual(['/api/v1/tests', '/api/v1/tests/abc/responses', '/api/v1/tests', '/api/v1/tests/xyz/responses'])
    expect(client.status).toMatchObject({ sent: 1, pending: 0, rejected: 0 })
  })

  it('retries a "too many requests" or server error instead of rejecting the answer', async () => {
    const { fn } = scripted([created(), refused(429), refused(500)], stored)
    const client = new StudyClient({ fetch: fn, retryDelaysMs: [100] })
    client.start(SESSION)
    client.submit(answer(1))
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.status).toMatchObject({ sent: 1, rejected: 0 })
  })

  it('flush() tries at once without waiting for the timer', async () => {
    const { fn } = scripted([created(), offline()], stored)
    const client = new StudyClient({ fetch: fn, retryDelaysMs: [60_000] })
    client.start(SESSION)
    client.submit(answer(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(client.status.pending).toBe(1)
    await client.flush()
    expect(client.status).toMatchObject({ sent: 1, pending: 0 })
  })

  it('tells listeners about every change, and stops when they unsubscribe', async () => {
    const { fn } = scripted([created()], stored)
    const client = new StudyClient({ fetch: fn })
    const listener = vi.fn()
    const unsubscribe = client.subscribe(listener)
    client.start(SESSION)
    client.submit(answer(1))
    await client.flush()
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    listener.mockClear()
    client.submit(answer(2))
    await client.flush()
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops retrying when disposed', async () => {
    const { fn, calls } = scripted([created()], () => offline())
    const client = new StudyClient({ fetch: fn, retryDelaysMs: [100] })
    client.start(SESSION)
    client.submit(answer(1))
    await vi.advanceTimersByTimeAsync(0)
    const before = calls.length
    client.dispose()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(before)
  })

  it('sends nothing until a session has been started with consent', async () => {
    const { fn, calls } = scripted([], created)
    const client = new StudyClient({ fetch: fn })
    client.submit(answer(1))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(0)
  })
})
