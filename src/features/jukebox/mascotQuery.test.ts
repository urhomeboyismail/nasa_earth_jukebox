import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryMascot } from './mascotQuery'

const catalog = [{ id: 'fixture', title: 'Fixture ocean', summary: 'Four test frames.' }]
const audio = { base_bpm: 100, tracks: [{ instrument: 'marimba', pitch_range: [52, 76], volume_curve: [0.15, 1] }] }
const good = { mascot_reply: 'I found 2 days of sea surface temperature.', dataset_theme: 'ocean', sonification_json: audio, local_dataset_id: null }

function answer(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers })))
}

const ask = () => queryMascot({ prompt: 'SST near Mauritius', preference: 'normal', catalog })

afterEach(() => vi.unstubAllGlobals())

describe('queryMascot', () => {
  it('sends the question, the preference and the catalog, and reads a good answer', async () => {
    answer(200, good)
    expect(await ask()).toEqual({ kind: 'answer', answer: { reply: good.mascot_reply, theme: 'ocean', audio, localId: null, series: null } })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/\/api\/v1\/mascot\/query$/)
    expect(JSON.parse(String(init?.body))).toEqual({ user_prompt: 'SST near Mauritius', audio_preference: 'normal', catalog })
  })

  it('drops a payload that does not pass, and keeps the reply', async () => {
    answer(200, { ...good, sonification_json: { base_bpm: 5000, tracks: [] } })
    const result = await ask()
    expect(result.kind === 'answer' && result.answer.audio).toBeNull()
    expect(result.kind === 'answer' && result.answer.reply).toBe(good.mascot_reply)
  })

  it('reads the series behind the sound, and drops one that does not pass (WX02)', async () => {
    const series = { metric: 'Sea surface temperature', unit: '°C', times: ['2026-06-01', '2026-06-02'], values: [24.1, 24.6] }
    answer(200, { ...good, series })
    const read = await ask()
    expect(read.kind === 'answer' && read.answer.series).toEqual(series)
    answer(200, { ...good, series: { ...series, values: [24.1] } }) // one value short
    const short = await ask()
    expect(short.kind === 'answer' && [short.answer.series, short.answer.reply]).toEqual([null, good.mascot_reply])
  })

  it('keeps a local data set only if it was sent, and an unknown theme becomes default', async () => {
    answer(200, { ...good, local_dataset_id: 'somewhere-else', dataset_theme: 'lava' })
    const unsent = await ask()
    expect(unsent.kind === 'answer' && [unsent.answer.localId, unsent.answer.theme]).toEqual([null, 'default'])
    answer(200, { ...good, local_dataset_id: 'fixture' })
    const sent = await ask()
    expect(sent.kind === 'answer' && sent.answer.localId).toBe('fixture')
  })

  it.each([
    [429, 'rate'],
    [502, 'model'],
    [504, 'model'],
    [503, 'off'],
    [404, 'unreachable'],
  ])('maps status %i to %s', async (status, error) => {
    answer(status)
    expect(await ask()).toEqual({ kind: 'error', error })
  })

  it('passes on the wait from a 429', async () => {
    answer(429, {}, { 'Retry-After': '7' })
    expect(await ask()).toEqual({ kind: 'error', error: 'rate', retryAfter: 7 })
  })

  it('a reply without text, or no server, is an error and never a throw', async () => {
    answer(200, { ...good, mascot_reply: '' })
    expect(await ask()).toEqual({ kind: 'error', error: 'model' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    expect(await ask()).toEqual({ kind: 'error', error: 'unreachable' })
  })
})
