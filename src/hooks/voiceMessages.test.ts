import { describe, expect, it } from 'vitest'
import { parseServerMessage, playerCommandSchema } from './voiceMessages'

const parse = (value: unknown) => parseServerMessage(JSON.stringify(value))

describe('parseServerMessage', () => {
  it.each([
    [{ type: 'ready' }],
    [{ type: 'ready', limitSeconds: 600 }],
    [{ type: 'transcript', role: 'user', text: 'Hello' }],
    [{ type: 'transcript', role: 'assistant', text: 'Hi' }],
    [{ type: 'interrupted' }],
    [{ type: 'turn_complete' }],
    [{ type: 'action', action: 'navigate', page: 'learn' }],
    [{ type: 'action', action: 'player', command: { setDate: '2024-07-15' } }],
    [{ type: 'error', code: 'busy', message: 'The voice guide is busy.' }],
    [{ type: 'ended', reason: 'time_limit' }],
  ])('returns %j', value => {
    expect(parse(value)).toEqual(value)
  })

  it('ignores a limit that is not a positive number, but keeps the message', () => {
    expect(parse({ type: 'ready', limitSeconds: -5 })).toEqual({ type: 'ready' })
    expect(parse({ type: 'ready', limitSeconds: 'soon' })).toEqual({ type: 'ready' })
  })

  it.each([
    ['invalid JSON', '{nope'],
    ['no type', JSON.stringify({ role: 'user', text: 'x' })],
    ['an unknown type', JSON.stringify({ type: 'surprise' })],
    ['a transcript with role "system"', JSON.stringify({ type: 'transcript', role: 'system', text: 'x' })],
    ['a transcript without text', JSON.stringify({ type: 'transcript', role: 'user' })],
    ['an error without a message', JSON.stringify({ type: 'error', code: 'busy' })],
    ['an action without an action name', JSON.stringify({ type: 'action', page: 'home' })],
    ['a JSON array', '[1]'],
    ['null', 'null'],
  ])('returns null for %s', (_name, text) => {
    expect(parseServerMessage(text)).toBeNull()
  })
})

describe('playerCommandSchema', () => {
  it('accepts the six words and an object with only a real date', () => {
    for (const word of ['play', 'pause', 'stop', 'replay', 'next', 'previous']) expect(playerCommandSchema.safeParse(word).success).toBe(true)
    expect(playerCommandSchema.safeParse({ setDate: '2024-02-29' }).success).toBe(true)
  })

  it('refuses anything else', () => {
    for (const bad of ['dance', '', { setDate: '2024-02-30' }, { setDate: '2024-7-1' }, { setDate: 20240701 }, { setDate: '2024-07-01', extra: 1 }, {}, null, 7]) {
      expect(playerCommandSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }
  })
})
