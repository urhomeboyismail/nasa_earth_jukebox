import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { forgetKeptValues } from '../hooks/useStoredValue'
import { FakeAudioContext, installFakeAudioContext } from '../test/fakes'
import { CUE_NOTES, CUES_KEY, cuesOn, playCue, resetCues, setCuesOn } from './cues'

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

  it('does nothing where there is no AudioContext', () => {
    audio.uninstall()
    expect(() => playCue('answer')).not.toThrow()
  })
})
