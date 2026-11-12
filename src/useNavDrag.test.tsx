import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNavDrag } from './useNavDrag'

// A 400 px bar with 4 tabs: padding 6, so each tab is 97 px wide.
const COUNT = 4
const onSelect = vi.fn()

function Bar() {
  const { handlers } = useNavDrag(COUNT, onSelect)
  return <nav data-testid="bar" {...handlers}><a href="#a" data-testid="link">A</a></nav>
}

const ptr = { pointerId: 1, button: 0, isPrimary: true }
const tabX = (i: number) => 6 + 97 * i + 48.5

function stubMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query }))
}

beforeEach(() => {
  onSelect.mockClear()
  stubMedia(true)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 50, right: 400, bottom: 50, x: 0, y: 0, toJSON() {} })
  HTMLElement.prototype.setPointerCapture = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useNavDrag', () => {
  it('calls nothing for a press and release without movement', () => {
    render(<Bar />)
    const bar = screen.getByTestId('bar')
    fireEvent.pointerDown(bar, { ...ptr, clientX: 50, clientY: 10 })
    fireEvent.pointerUp(bar, { ...ptr, clientX: 50, clientY: 10 })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selects the tab under the release point and suppresses the click for 350 ms', () => {
    vi.useFakeTimers()
    render(<Bar />)
    const bar = screen.getByTestId('bar'), link = screen.getByTestId('link')
    fireEvent.pointerDown(bar, { ...ptr, clientX: tabX(0), clientY: 10 })
    fireEvent.pointerMove(bar, { ...ptr, clientX: tabX(2), clientY: 12 })
    fireEvent.pointerUp(bar, { ...ptr, clientX: tabX(2), clientY: 12 })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(2)
    expect(fireEvent.click(link)).toBe(false)
    act(() => { vi.advanceTimersByTime(351) })
    expect(fireEvent.click(link)).toBe(true)
  })

  it('cancels on a mostly vertical move', () => {
    render(<Bar />)
    const bar = screen.getByTestId('bar')
    fireEvent.pointerDown(bar, { ...ptr, clientX: 100, clientY: 10 })
    fireEvent.pointerMove(bar, { ...ptr, clientX: 102, clientY: 40 })
    fireEvent.pointerMove(bar, { ...ptr, clientX: 300, clientY: 40 })
    fireEvent.pointerUp(bar, { ...ptr, clientX: 300, clientY: 40 })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does nothing on a wide screen', () => {
    stubMedia(false)
    render(<Bar />)
    const bar = screen.getByTestId('bar')
    fireEvent.pointerDown(bar, { ...ptr, clientX: tabX(0), clientY: 10 })
    fireEvent.pointerMove(bar, { ...ptr, clientX: tabX(2), clientY: 10 })
    fireEvent.pointerUp(bar, { ...ptr, clientX: tabX(2), clientY: 10 })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('clears the drag on pointer cancel without selecting', () => {
    render(<Bar />)
    const bar = screen.getByTestId('bar')
    fireEvent.pointerDown(bar, { ...ptr, clientX: tabX(0), clientY: 10 })
    fireEvent.pointerMove(bar, { ...ptr, clientX: tabX(2), clientY: 10 })
    fireEvent.pointerCancel(bar, ptr)
    fireEvent.pointerUp(bar, { ...ptr, clientX: tabX(2), clientY: 10 })
    expect(onSelect).not.toHaveBeenCalled()
  })
})
