import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { forgetKeptValues } from '../hooks/useStoredValue'
import { FakeAudioContext, installFakeAudioContext, type FakeGainNode } from '../test/fakes'
import { duck } from './duck'
import { CUE_NOTES, CUES_KEY, cueMs, cuesOn, playCue, resetCues, setCuesOn, type Cue } from './cues'

describe('interface cues', () => {
  let audio: ReturnType<typeof installFakeAudioContext>
  beforeEach(() => { localStorage.clear(); forgetKeptValues(); resetCues(); audio = installFakeAudioContext() })
  afterEach(() => audio.uninstall())

  const context = () => audio.contexts[0] as FakeAudioContext

  it('plays each cue as quiet sine blips at its notes, from one shared context', () => {
    playCue('connected')
    playCue('error')
    expect(audio.contexts).toHaveLength(1)
    const oscillators = context().oscillators
    expect(oscillators.map(o => o.type)).toEqual(['sine', 'sine', 'sine', 'sine'])
    expect(oscillators.map(o => o.frequency.value)).toEqual([...CUE_NOTES.connected, ...CUE_NOTES.error].map(([hz]) => hz))
    expect(oscillators[1].started).toEqual([0.09])
    expect(oscillators.every(o => o.stopped[0] > o.started[0])).toBe(true)
  })

  it('rises when the guide connects and falls when it ends', () => {
    const notes = (cue: keyof typeof CUE_NOTES) => CUE_NOTES[cue].map(([hz]) => hz)
    expect(notes('connected')[1]).toBeGreaterThan(notes('connected')[0])
    expect(notes('ended')).toEqual([...notes('connected')].reverse())
  })

  it('stays quiet when switched off, and the choice is kept', () => {
    expect(cuesOn()).toBe(true)
    setCuesOn(false)
    expect(localStorage.getItem(CUES_KEY)).toBe('off')
    playCue('answer')
    expect(audio.contexts).toHaveLength(0)
    setCuesOn(true)
    expect(localStorage.getItem(CUES_KEY)).toBeNull()
    playCue('answer')
    expect(context().oscillators).toHaveLength(1)
  })

  it('has notes for every cue, and none is longer than 400 ms', () => {
    const cues = Object.keys(CUE_NOTES) as Cue[]
    expect(cues).toEqual(expect.arrayContaining(['connected', 'ended', 'answer', 'error', 'start', 'stop', 'compareA', 'compareB', 'success']))
    for (const cue of cues) {
      expect(CUE_NOTES[cue].length).toBeGreaterThan(0)
      expect(cueMs(cue)).toBeLessThanOrEqual(400)
    }
  })

  it('shapes the new cues: start rises, stop falls, A is one blip, B is two, success is three rising', () => {
    const hz = (cue: Cue) => CUE_NOTES[cue].map(([f]) => f)
    expect(hz('start')[1]).toBeGreaterThan(hz('start')[0])
    expect(hz('stop')).toEqual([...hz('start')].reverse())
    expect(hz('compareA')).toHaveLength(1)
    expect(hz('compareB')).toHaveLength(2)
    expect(hz('success')).toEqual([...hz('success')].sort((a, b) => a - b))
    expect(hz('success')).toHaveLength(3)
  })

  it('plays every cue at the same quiet level, and says how long it sounded', () => {
    const lengths = (['start', 'stop', 'compareA', 'compareB', 'success'] as Cue[]).map(cue => playCue(cue))
    expect(lengths.every(ms => ms > 0 && ms <= 400)).toBe(true)
    expect(context().oscillators).toHaveLength(2 + 2 + 1 + 2 + 3)
    const levels = context().oscillators.map(o => (o.connected[0] as FakeGainNode).gain.calls[0].args[0])
    expect(levels.every(level => level === 0.04)).toBe(true)
  })

  it('stays quiet for every cue when switched off', () => {
    setCuesOn(false)
    for (const cue of Object.keys(CUE_NOTES) as Cue[]) expect(playCue(cue)).toBe(0)
    expect(audio.contexts).toHaveLength(0)
  })

  it('keeps the playback, Compare and success cues from talking over a voice', () => {
    duck.begin('guide')
    try {
      expect(playCue('start')).toBe(0)
      expect(playCue('compareA')).toBe(0)
      expect(audio.contexts).toHaveLength(0)
    } finally {
      duck.reset()
    }
    expect(playCue('start')).toBeGreaterThan(0)
  })

  it('does nothing where there is no AudioContext', () => {
    audio.uninstall()
    expect(() => playCue('answer')).not.toThrow()
  })
})
