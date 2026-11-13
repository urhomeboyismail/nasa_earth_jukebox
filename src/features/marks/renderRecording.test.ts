import { describe, expect, it } from 'vitest'
import type { ScheduledFrame } from '../../audio/ensemble/types'
import { RENDER_SAMPLE_RATE, RENDER_TAIL_SECONDS } from '../../sonify/schedule'
import { bytesOf, loadPixelsFrom, manifestOf, sha256Hex, sineRender } from '../playlist/testKit'
import { logDate, startLog } from './record'
import { renderRecording } from './renderRecording'

describe('renderRecording', () => {
  const fixture = manifestOf('fixture')
  const deps = { loadPixels: loadPixelsFrom('fixture'), renderOffline: sineRender }

  it('renders the dates heard, at the times they were heard, through the same render', async () => {
    const seen: ScheduledFrame[][] = []
    let log = startLog(0)
    log = logDate(log, 2, 1500)
    log = logDate(log, 1, 4000)
    await renderRecording(fixture, log, { ...deps, renderOffline: async (schedule, options, preset) => { seen.push(schedule); return sineRender(schedule, options, preset) } })
    expect(seen).toHaveLength(1)
    expect(seen[0].map(s => s.atSeconds)).toEqual([0, 1.5, 4])
    // The frames are the ones of the dates heard (frame ids, in the order of the log).
    const ids = [...fixture.frames].map(f => f.id)
    expect(seen[0].map(s => s.frame.frameId)).toEqual([ids[0], ids[2], ids[1]])
  })

  it('makes a stereo 16-bit WAV as long as the last step plus the tail, and the same bytes for the same log', async () => {
    let log = startLog(0)
    log = logDate(log, 1, 3000)
    const first = await renderRecording(fixture, log, deps)
    const second = await renderRecording(fixture, log, deps)
    expect(await sha256Hex(first)).toBe(await sha256Hex(second))
    const view = new DataView(await bytesOf(first))
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(Math.round((3 + RENDER_TAIL_SECONDS) * RENDER_SAMPLE_RATE) * 4)
  })

  it('refuses an empty log with words', async () => {
    await expect(renderRecording(fixture, { events: [], full: false }, deps)).rejects.toThrow('nothing recorded')
  })
})
