import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateJukebox } from './generate'

const request = { query: 'Show sea ice', contrast: 'high', detailLevel: 'brief' } as const
const audio = { base_bpm: 90, tracks: [{ instrument: 'marimba', pitch_range: [48, 72], volume_curve: [0.2, 0.8] }] }
const vision = { descriptions: [{ timestamp_sec: 0, alt_text: 'Pale water.', intensity_level: 'low' }] }

function answer(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('generateJukebox', () => {
  it('posts the question and the accessibility profile', async () => {
    const fetchMock = answer(200, { approved: true, feedback: '', revisions: 0, audio, vision })
    await generateJukebox(request)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/jukebox/generate')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ query: 'Show sea ice', accessibilityProfile: { contrast: 'high', detailLevel: 'brief' } })
  })

  it('returns the checked answer', async () => {
    answer(200, { approved: true, feedback: '', revisions: 1, audio, vision })
    expect(await generateJukebox(request)).toEqual({ kind: 'answer', answer: { approved: true, feedback: '', audio, vision } })
  })

  it('keeps the audio and drops a vision half that is not valid', async () => {
    answer(200, { approved: false, feedback: 'No descriptions.', revisions: 3, audio, vision: { descriptions: 'x' } })
    expect(await generateJukebox(request)).toEqual({ kind: 'answer', answer: { approved: false, feedback: 'No descriptions.', audio, vision: null } })
  })

  it('says nothing was made when the route answers with no audio', async () => {
    answer(200, { approved: false, feedback: 'No data.', revisions: 0, audio: null, vision: null })
    expect(await generateJukebox(request)).toEqual({ kind: 'nothing' })
  })

  it.each([
    [429, 'rate'],
    [502, 'model'],
    [504, 'model'],
    [503, 'off'],
    [500, 'unreachable'],
    [404, 'unreachable'],
  ])('maps status %i to %s', async (status, error) => {
    answer(status)
    expect(await generateJukebox(request)).toEqual({ kind: 'error', error })
  })

  it.each([
    ['12', 12],
    ['soon', undefined],
    ['0', undefined],
    [null, undefined],
  ])('reads Retry-After %s on a 429 as %s seconds', async (header, retryAfter) => {
    const headers: Record<string, string> = header === null ? {} : { 'Retry-After': header }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers })))
    const result = await generateJukebox(request)
    expect(result).toEqual({ kind: 'error', error: 'rate', ...(retryAfter && { retryAfter }) })
    expect('retryAfter' in result).toBe(retryAfter !== undefined)
  })

  it('does not throw on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    expect(await generateJukebox(request)).toEqual({ kind: 'error', error: 'unreachable' })
  })

  it.each([
    ['text', 'hello'],
    ['no approved flag', { audio }],
    ['audio that is not audio', { approved: true, feedback: '', audio: { base_bpm: 5, tracks: [] } }],
  ])('treats %s as a model error', async (_name, body) => {
    answer(200, body)
    expect(await generateJukebox(request)).toEqual({ kind: 'error', error: 'model' })
  })

  it('treats a body that is not JSON as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })))
    expect(await generateJukebox(request)).toEqual({ kind: 'error', error: 'unreachable' })
  })
})
