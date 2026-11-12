import { describe, expect, it } from 'vitest'
import { RENDER_SAMPLE_RATE, RENDER_TAIL_SECONDS } from '../../sonify/schedule'
import { renderSequence } from './renderSequence'
import { bytesOf, depsFor, manifestOf, sha256Hex } from './testKit'

describe('renderSequence', () => {
  const fixture = manifestOf('fixture')

  it('gives the same bytes when the same data set is rendered twice', async () => {
    const first = await renderSequence(fixture, depsFor('fixture'))
    const second = await renderSequence(fixture, depsFor('fixture'))
    expect(await sha256Hex(first.wav)).toBe(await sha256Hex(second.wav))
    expect(first.vtt).toBe(second.vtt)
    expect(first.sidecar).toBe(second.sidecar)
  })

  it('writes a 16-bit stereo WAV at 44100 Hz with one sample per channel for the whole schedule', async () => {
    const out = await renderSequence(fixture, depsFor('fixture'))
    const view = new DataView(await bytesOf(out.wav))
    const text = (offset: number) => String.fromCharCode(...[0, 1, 2, 3].map(i => view.getUint8(offset + i)))
    expect(text(0)).toBe('RIFF')
    expect(text(8)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint16(34, true)).toBe(16)
    const samples = Math.round((fixture.frames.length - 1 + RENDER_TAIL_SECONDS) * RENDER_SAMPLE_RATE)
    expect(view.getUint32(40, true)).toBe(samples * 4)
    expect(out.seconds).toBeCloseTo(fixture.frames.length - 1 + RENDER_TAIL_SECONDS, 3)
  })

  it('has one caption cue and one sidecar entry for each date, in date order, with the frame ids', async () => {
    const out = await renderSequence(fixture, depsFor('fixture'))
    const ids = [...fixture.frames].sort((a, b) => a.date.localeCompare(b.date)).map(frame => frame.id)
    const cues = out.vtt.trim().split('\n\n').slice(1)
    expect(cues.map(cue => cue.split('\n')[0])).toEqual(ids)
    for (const cue of cues) expect(cue.split('\n').slice(2).join('').trim()).not.toBe('')
    const sidecar = JSON.parse(out.sidecar)
    expect(sidecar.frames.map((f: { frameId: string }) => f.frameId)).toEqual(ids)
    expect(sidecar.frames.map((f: { atSeconds: number }) => f.atSeconds)).toEqual(ids.map((_, i) => i))
  })

  it('says the dropout sentence for a date that cannot be read', async () => {
    const out = await renderSequence(fixture, depsFor('fixture'))
    const sidecar = JSON.parse(out.sidecar)
    const dropped = sidecar.frames.filter((f: { dropout: boolean }) => f.dropout)
    expect(dropped.length).toBeGreaterThan(0)
    for (const f of dropped) expect(out.vtt).toContain(f.summary)
  })

  it('holds no time stamp or host name anywhere', async () => {
    const out = await renderSequence(fixture, depsFor('fixture'))
    expect(out.sidecar + out.vtt).not.toMatch(/localhost|https?:\/\/|renderedAt|timestamp/i)
  })

  it('names the date when a picture cannot be read', async () => {
    const failing = { ...depsFor('fixture'), loadPixels: async () => { throw new Error('Could not load it (HTTP 404).') } }
    await expect(renderSequence(fixture, failing)).rejects.toThrow(/picture for .* could not be read\. Could not load it \(HTTP 404\)/)
  })

  it('refuses a data set with no frames', async () => {
    await expect(renderSequence({ ...fixture, frames: [] }, depsFor('fixture'))).rejects.toThrow(/no frames/)
  })
})
