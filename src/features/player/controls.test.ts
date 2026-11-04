import { describe, expect, it, vi } from 'vitest'
import { onPlayerCommand, sendPlayerCommand } from './controls'

describe('player commands', () => {
  it('delivers commands to listeners until they unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = onPlayerCommand(listener)
    sendPlayerCommand('play')
    sendPlayerCommand({ setDate: '2024-07-15' })
    unsubscribe()
    sendPlayerCommand('stop')
    expect(listener.mock.calls).toEqual([['play'], [{ setDate: '2024-07-15' }]])
  })
})
