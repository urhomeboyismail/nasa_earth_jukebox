import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Action } from './actions'
import { BUTTON } from './gamepad'
import { addActionHandler, resetActionHandlers } from './registry'
import type { Scope } from './shortcuts'
import { useGamepad, useKeyboard } from './useInput'

const log: Action[] = []
beforeEach(() => { log.length = 0 })
afterEach(() => { resetActionHandlers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const listen = (...types: Action['type'][]) => types.forEach(type => addActionHandler(type, action => { log.push(action) }))

function Region({ scopes, children, label }: { scopes: readonly Scope[]; children?: React.ReactNode; label: string }) {
  const onKeyDown = useKeyboard(scopes)
  return <div role="group" aria-label={label} tabIndex={0} onKeyDown={onKeyDown}>{children}</div>
}

describe('useKeyboard', () => {
  it('dispatches the action of a key in its scopes, and stops the key when something handled it', () => {
    render(<Region scopes={['map']} label="map" />)
    listen('lock')
    expect(fireEvent.keyDown(screen.getByRole('group'), { key: 'l', code: 'KeyL' })).toBe(false)
    expect(log).toEqual([{ type: 'lock' }])
  })

  it('lets a key carry on when nothing handles its action, so it is not swallowed for nothing', () => {
    render(<Region scopes={['map']} label="map" />)
    expect(fireEvent.keyDown(screen.getByRole('group'), { key: 'l', code: 'KeyL' })).toBe(true)
  })

  it('ignores keys outside its scopes, and keys with Ctrl, Cmd or Alt', () => {
    render(<Region scopes={['map']} label="map" />)
    listen('lock', 'transport', 'move')
    fireEvent.keyDown(screen.getByRole('group'), { key: ' ', code: 'Space' })
    fireEvent.keyDown(screen.getByRole('group'), { key: 'l', code: 'KeyL', ctrlKey: true })
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight', altKey: true })
    expect(log).toEqual([])
  })

  it('does not take Space from a button, nor the arrows from a text box, and ignores editable text', async () => {
    const user = userEvent.setup()
    render(<Region scopes={['listen']} label="listen"><button type="button">Press</button><input aria-label="Name" /><div contentEditable suppressContentEditableWarning aria-label="Note" role="textbox" /></Region>)
    listen('transport', 'scrubTime')
    await user.click(screen.getByRole('button', { name: 'Press' }))
    log.length = 0
    await user.keyboard(' ')
    expect(log).toEqual([])
    await user.click(screen.getByRole('textbox', { name: 'Name' }))
    await user.keyboard('{ArrowRight} ')
    expect(log).toEqual([])
    // jsdom does not implement isContentEditable, so it is given.
    Object.defineProperty(screen.getByRole('textbox', { name: 'Note' }), 'isContentEditable', { value: true })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note' }), { key: 'ArrowRight' })
    expect(log).toEqual([])
    // On the region itself the same keys are the shortcuts.
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('group'), { key: ' ', code: 'Space' })
    expect(log).toEqual([{ type: 'scrubTime', by: 1 }, { type: 'transport', command: 'toggle' }])
  })

  it('dispatches a key once when it bubbles from the map to the Listen section', () => {
    render(<Region scopes={['listen', 'anywhere']} label="listen"><Region scopes={['map', 'anywhere']} label="map" /></Region>)
    listen('stopSpeech')
    const inner = screen.getByRole('group', { name: 'map' })
    // Escape is not stopped (a dialog still needs it), so it reaches the outer region as well, which must not answer it again.
    expect(fireEvent.keyDown(inner, { key: 'Escape' })).toBe(true)
    expect(log).toEqual([{ type: 'stopSpeech' }])
  })

  it('dispatches Ctrl+Z and Cmd+Z as undo', () => {
    render(<Region scopes={['listen']} label="listen" />)
    listen('undo')
    fireEvent.keyDown(screen.getByRole('group'), { key: 'z', code: 'KeyZ', ctrlKey: true })
    fireEvent.keyDown(screen.getByRole('group'), { key: 'z', code: 'KeyZ', metaKey: true })
    expect(log).toEqual([{ type: 'undo' }, { type: 'undo' }])
  })
})

describe('useGamepad', () => {
  let frames: ((time: number) => void)[]
  let buttons: boolean[]
  let axes: number[]

  function pad() {
    return { connected: true, mapping: 'standard', buttons: buttons.map(pressed => ({ pressed })), axes }
  }
  const step = (ms = 16) => act(() => { const next = frames.shift(); next?.(ms) })

  function Pad() {
    useGamepad()
    return null
  }

  beforeEach(() => {
    frames = []
    buttons = Array.from({ length: 17 }, () => false)
    axes = [0, 0, 0, 0]
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => frames.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => { frames.length = 0 })
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { getGamepads: () => [pad()] }))
  })

  it('dispatches a button once while it is held, and again after it is released and pressed', () => {
    render(<Pad />)
    listen('transport', 'stopSpeech')
    buttons[BUTTON.A] = true
    step()
    step()
    step()
    expect(log).toEqual([{ type: 'transport', command: 'toggle' }])
    buttons[BUTTON.A] = false
    step()
    buttons[BUTTON.B] = true
    step()
    expect(log).toEqual([{ type: 'transport', command: 'toggle' }, { type: 'stopSpeech' }])
  })

  it('does not poll when no standard pad is connected', () => {
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { getGamepads: () => [null] }))
    render(<Pad />)
    expect(frames).toHaveLength(0)
  })

  it('stops polling when it unmounts', () => {
    const { unmount } = render(<Pad />)
    expect(frames).toHaveLength(1)
    unmount()
    expect(frames).toHaveLength(0)
  })
})
