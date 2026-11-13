import { afterEach, describe, expect, it, vi } from 'vitest'
import { rumble } from './pad'

function pads(list: unknown[]) {
  Object.defineProperty(navigator, 'getGamepads', { value: () => list, configurable: true })
}
afterEach(() => { Object.defineProperty(navigator, 'getGamepads', { value: undefined, configurable: true }) })

describe('rumble', () => {
  it('gives a pad with an actuator a dual-rumble effect for each buzz, with the pause as a start delay', () => {
    const playEffect = vi.fn(async () => 'complete')
    pads([{ vibrationActuator: { playEffect } }])
    expect(rumble([20, 40, 20], 0.8)).toBe(1)
    expect(playEffect).toHaveBeenCalledTimes(2)
    expect(playEffect).toHaveBeenNthCalledWith(1, 'dual-rumble', { startDelay: 0, duration: 20, strongMagnitude: 0.8, weakMagnitude: 0.4 })
    expect(playEffect).toHaveBeenNthCalledWith(2, 'dual-rumble', { startDelay: 60, duration: 20, strongMagnitude: 0.8, weakMagnitude: 0.4 })
  })

  it('keeps the magnitude between 0 and 1', () => {
    const playEffect = vi.fn(async () => 'complete')
    pads([{ vibrationActuator: { playEffect } }])
    rumble([30], 3)
    expect(playEffect).toHaveBeenCalledWith('dual-rumble', expect.objectContaining({ strongMagnitude: 1 }))
  })

  it('leaves a pad with no actuator alone, and a missing slot', () => {
    const playEffect = vi.fn(async () => 'complete')
    pads([null, { vibrationActuator: null }, {}, { vibrationActuator: { playEffect } }])
    expect(rumble([30], 0.5)).toBe(1)
    expect(playEffect).toHaveBeenCalledTimes(1)
  })

  it('does nothing in a browser with no gamepads, and survives a pad that refuses', async () => {
    expect(rumble([30], 0.5)).toBe(0)
    pads([{ vibrationActuator: { playEffect: () => { throw new Error('no') } } }, { vibrationActuator: { playEffect: async () => { throw new Error('no') } } }])
    expect(() => rumble([30], 0.5)).not.toThrow()
    await Promise.resolve()
  })
})
