import { describe, expect, it } from 'vitest'
import { toAssistantAction } from './useVoiceAssistant'

describe('toAssistantAction', () => {
  it('accepts navigation to a known page', () => {
    expect(toAssistantAction({ action: 'navigate', page: 'listen' })).toEqual({ action: 'navigate', page: 'listen' })
  })

  it.each(['admin', '', 5, null, undefined])('rejects navigation to %s', page => {
    expect(toAssistantAction({ action: 'navigate', page })).toBeNull()
  })

  it.each(['play', 'pause', 'stop', 'replay', 'next', 'previous'])('accepts the player command "%s"', command => {
    expect(toAssistantAction({ action: 'player', command })).toEqual({ action: 'player', command })
  })

  it('accepts setting a real date', () => {
    expect(toAssistantAction({ action: 'player', command: { setDate: '2024-07-15' } })).toEqual({ action: 'player', command: { setDate: '2024-07-15' } })
    expect(toAssistantAction({ action: 'player', command: { setDate: '2024-02-29' } })).not.toBeNull() // a leap day
  })

  it.each([
    'rewind', 'PLAY', ' play', '', 'play;stop', 5, null, undefined, [], ['play'], true,
    { setDate: '15 July 2024' }, { setDate: '2024-7-15' }, { setDate: '2024-02-30' }, { setDate: '2023-02-29' }, { setDate: '2024-13-01' },
    { setDate: 20240715 }, { setDate: null }, {}, { setDate: '2024-07-15', extra: 1 }, { date: '2024-07-15' }, { SetDate: '2024-07-15' },
  ])('rejects the player command %j', command => {
    expect(toAssistantAction({ action: 'player', command })).toBeNull()
  })

  it('rejects an action it does not know, and a player action with no command', () => {
    expect(toAssistantAction({ action: 'delete_everything' })).toBeNull()
    expect(toAssistantAction({ action: 'player' })).toBeNull()
    expect(toAssistantAction({})).toBeNull()
  })
})
