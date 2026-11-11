import { describe, expect, it } from 'vitest'
import { toSidecar, type SidecarInput } from './sidecar'

const input = (): SidecarInput => ({
  id: 'demo', title: 'Demo', preset: 'major', detail: 'full', sampleRate: 44100, stepSeconds: 0.85, dropoutSeed: 20261109,
  frames: [
    { frameId: 'a', date: '2024-01-01', atSeconds: 0, confidence: 0.98765, dropout: false, missing: [], summary: 'One.', hotspotIds: ['h1'] },
    { frameId: 'b', date: '2024-01-02', atSeconds: 0.85, confidence: 0, dropout: true, missing: ['melody'], summary: 'Two.', hotspotIds: [] },
  ],
})

describe('toSidecar', () => {
  it('is JSON with one entry per frame, mapping each date to its second', () => {
    const parsed = JSON.parse(toSidecar(input()))
    expect(parsed.id).toBe('demo')
    expect(parsed.frames).toHaveLength(2)
    expect(parsed.frames[1]).toEqual({ frameId: 'b', date: '2024-01-02', atSeconds: 0.85, confidence: 0, dropout: true, missing: ['melody'], summary: 'Two.', hotspotIds: [] })
    expect(parsed.frames[0].confidence).toBe(0.988)
  })

  it('rounds seconds so floating-point noise never shows', () => {
    const noisy = input()
    noisy.frames[1].atSeconds = 0.1 + 0.2 + 0.55
    expect(JSON.parse(toSidecar(noisy)).frames[1].atSeconds).toBe(0.85)
  })

  it('is the same text every time and holds no time stamp, host or random id', () => {
    const first = toSidecar(input())
    expect(toSidecar(input())).toBe(first)
    expect(Object.keys(JSON.parse(first)).sort()).toEqual(['detail', 'dropoutSeed', 'frames', 'id', 'preset', 'sampleRate', 'stepSeconds', 'title'])
    expect(first).not.toMatch(/localhost|https?:|renderedAt|createdAt|timestamp/i)
  })
})
