// WebVTT captions for a rendered file (docs/PLAN.md §6.3, ticket SN12): one cue per date, with the words the caption strip shows.
// Pure: the same cues always give the same text.

import { VOICE_IDS } from '../data/sonification'
import type { MusicFrame } from './types'

export type Cue = { id: string; startSeconds: number; endSeconds: number; text: string }

const pad = (value: number, width: number) => String(value).padStart(width, '0')

/** `HH:MM:SS.mmm`. */
export function vttTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 1000))
  const ms = total % 1000
  const s = Math.floor(total / 1000) % 60
  const m = Math.floor(total / 60000) % 60
  const h = Math.floor(total / 3600000)
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(ms, 3)}`
}

/** The cue text must not hold markup, an arrow or a blank line, which would end the cue early. */
function safeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

/** The frame's summary, then on the next line the lines of the voices that are not silent, in the order the captions list them. */
export function cueText(frame: Pick<MusicFrame, 'summary' | 'caption'>): string {
  const lines = VOICE_IDS.map(voice => frame.caption[voice]).filter(line => line !== '')
  return [frame.summary, lines.join(' ')].filter(part => part.trim() !== '').join('\n')
}

export function toVtt(cues: readonly Cue[]): string {
  const blocks = cues.map(cue => {
    const text = safeText(cue.text) || 'No description for this date.'
    return `${cue.id.replace(/\s+/g, '-')}\n${vttTime(cue.startSeconds)} --> ${vttTime(cue.endSeconds)}\n${text}`
  })
  return `WEBVTT\n\n${blocks.join('\n\n')}\n`
}
