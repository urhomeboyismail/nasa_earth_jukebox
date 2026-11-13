import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatch, resetActionHandlers, useActionHandler } from './registry'

afterEach(resetActionHandlers)

function Listener({ log, name, type = 'lock' }: { log: string[]; name: string; type?: 'lock' | 'undo' }) {
  useActionHandler(type, () => log.push(name))
  return null
}

describe('dispatch', () => {
  it('runs the handlers on the same tick, in the order they registered, and says there was one', () => {
    const log: string[] = []
    render(<><Listener log={log} name="a" /><Listener log={log} name="b" /></>)
    expect(dispatch({ type: 'lock' })).toBe(true)
    expect(log).toEqual(['a', 'b'])
  })

  it('ignores an action with no handler, and says so', () => {
    expect(dispatch({ type: 'mark' })).toBe(false)
  })

  it('only calls handlers of that kind', () => {
    const log: string[] = []
    render(<><Listener log={log} name="lock" /><Listener log={log} name="undo" type="undo" /></>)
    dispatch({ type: 'undo' })
    expect(log).toEqual(['undo'])
  })

  it('stops calling a handler when its component unmounts', () => {
    const log: string[] = []
    const { unmount } = render(<Listener log={log} name="a" />)
    unmount()
    expect(dispatch({ type: 'lock' })).toBe(false)
    expect(log).toEqual([])
  })

  it('calls the newest handler of a component without changing the order', () => {
    const calls: string[] = []
    function Changing({ tag }: { tag: string }) {
      useActionHandler('lock', () => calls.push(tag))
      return null
    }
    const { rerender } = render(<><Changing tag="first-1" /><Listener log={calls} name="second" /></>)
    rerender(<><Changing tag="first-2" /><Listener log={calls} name="second" /></>)
    dispatch({ type: 'lock' })
    expect(calls).toEqual(['first-2', 'second'])
  })

  it('passes the action itself', () => {
    const seen = vi.fn()
    function Move() {
      useActionHandler('move', seen)
      return null
    }
    render(<Move />)
    dispatch({ type: 'move', dx: 4, dy: 0 })
    expect(seen).toHaveBeenCalledWith({ type: 'move', dx: 4, dy: 0 })
  })
})
