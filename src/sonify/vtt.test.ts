import { describe, expect, it } from 'vitest'
import type { MusicFrame } from './types'
import { cueText, toVtt, vttTime } from './vtt'

const caption = (over: Partial<MusicFrame['caption']> = {}): MusicFrame['caption'] => ({ melody: '', harmony: '', bass: '', hotspots: '', rhythm: '', motion: '', time: '', ...over })

describe('vttTime', () => {
  it('writes HH:MM:SS.mmm', () => {
    expect(vttTime(0)).toBe('00:00:00.000')
    expect(vttTime(1.5)).toBe('00:00:01.500')
    expect(vttTime(0.425 * 3)).toBe('00:00:01.275')
    expect(vttTime(3723.004)).toBe('01:02:03.004')
  })
})

describe('cueText', () => {
  it('is the summary, then the audible lines in the order the captions list the voices', () => {
    const text = cueText({ summary: 'A warm day.', caption: caption({ bass: 'Bass is low.', melody: 'Melody is high.' }) })
    expect(text).toBe('A warm day.\nMelody is high. Bass is low.')
  })

  it('is the summary alone when every voice is silent', () => {
    expect(cueText({ summary: 'Nothing can be read.', caption: caption() })).toBe('Nothing can be read.')
  })
})

describe('toVtt', () => {
  const cues = [
    { id: 'f1', startSeconds: 0, endSeconds: 1, text: 'First.' },
    { id: 'f2', startSeconds: 1, endSeconds: 2, text: 'Second.\nMore.' },
  ]

  it('starts with WEBVTT and a blank line, with one cue per frame', () => {
    const vtt = toVtt(cues)
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true)
    expect(vtt).toBe('WEBVTT\n\nf1\n00:00:00.000 --> 00:00:01.000\nFirst.\n\nf2\n00:00:01.000 --> 00:00:02.000\nSecond.\nMore.\n')
  })

  it('has increasing timestamps and the frame ids as identifiers', () => {
    const blocks = toVtt(cues).trim().split('\n\n').slice(1)
    expect(blocks.map(block => block.split('\n')[0])).toEqual(['f1', 'f2'])
    const starts = blocks.map(block => /^(\S+) -->/.exec(block.split('\n')[1])![1])
    expect([...starts].sort()).toEqual(starts)
  })

  it('never leaves a cue empty, and keeps markup and blank lines out of the text', () => {
    const vtt = toVtt([{ id: 'x', startSeconds: 0, endSeconds: 1, text: '  ' }, { id: 'y', startSeconds: 1, endSeconds: 2, text: 'a <b> & c\n\nd' }])
    expect(vtt).toContain('No description for this date.')
    expect(vtt).toContain('a &lt;b&gt; &amp; c\nd')
  })
})
