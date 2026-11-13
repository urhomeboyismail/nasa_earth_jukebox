// The sources (ticket IX01): keyboard, pointer and gamepad. Each only builds an `Action` and calls `dispatch`; none changes the sound or the words itself.

import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent, type MouseEvent } from 'react'
import { LONG_PRESS_MS, START_GESTURE, stepGesture, type GestureEvent, type GestureOutput, type GestureState } from './gestures'
import { START_PAD, isStandardPad, stepGamepad, type PadState } from './gamepad'
import { isEditable, keyInputOf } from './keys'
import { dispatch } from './registry'
import { SHORTCUTS, type Scope } from './shortcuts'

/** Key presses already turned into an action, so one that bubbles from the sound map to the Listen section is not dispatched twice. */
const answered = new WeakSet<object>()

/**
 * A key handler for a part of the page. It finds the first shortcut in `scopes` that this key press makes an action of, and dispatches it. If something handled
 * the action the key is stopped there (except Escape, which a dialog still needs); otherwise it carries on as before.
 */
export function useKeyboard(scopes: readonly Scope[]): (event: KeyboardEvent) => void {
  return useCallback((event: KeyboardEvent) => {
    if (event.defaultPrevented || isEditable(event.target) || answered.has(event.nativeEvent)) return
    const input = keyInputOf(event)
    for (const shortcut of SHORTCUTS) {
      if (shortcut.device !== 'keyboard' || !scopes.includes(shortcut.scope)) continue
      if (shortcut.when && !shortcut.when(event.target)) continue
      const action = shortcut.match(input)
      if (!action) continue
      answered.add(event.nativeEvent)
      if (dispatch(action) && shortcut.prevent !== false) event.preventDefault()
      return
    }
  }, [scopes])
}

type Cell = { col: number; row: number }

type PointerOptions = {
  /** The cell under a pointer event, or null when the map is not ready. */
  cellAt: (event: PointerEvent<HTMLElement>) => Cell | null
  /** A mouse moving over the map with no button down sounds the place under it (the continuous tone). */
  hover: boolean
  /** The finger or pointer was lifted. */
  onRelease: () => void
  /** The pointer left the map with no button down. */
  onLeave: () => void
}

/** Pointer handlers for the sound map: a press or a drag is a place (`moveTo`), a long press or a right click is `query`, a two-finger tap is `stopSpeech`. */
export function usePointerInput({ cellAt, hover, onRelease, onLeave }: PointerOptions) {
  const state = useRef<GestureState>(START_GESTURE)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastType = useRef('mouse')
  /** The cell last sounded by a pointer, so movement inside one cell does not sound it again. */
  const lastCell = useRef<Cell | null>(null)

  const point = useCallback((cell: Cell, first: boolean) => {
    const last = lastCell.current
    if (!first && last && last.col === cell.col && last.row === cell.row) return
    lastCell.current = cell
    dispatch({ type: 'moveTo', col: cell.col, row: cell.row, via: 'pointer' })
  }, [])

  const run = useCallback((outputs: GestureOutput[], cell: Cell | null) => {
    for (const output of outputs) {
      if (output.kind === 'point' && cell) point(cell, output.first)
      else if (output.kind === 'action') dispatch(output.action)
      else if (output.kind === 'release') {
        lastCell.current = null
        onRelease()
      }
    }
  }, [onRelease, point])

  /** The newest `feed`, for the long-press timer to call (a callback cannot capture itself). */
  const latestFeed = useRef<(event: GestureEvent, cell: Cell | null) => void>(() => {})

  const feed = useCallback((event: GestureEvent, cell: Cell | null) => {
    const step = stepGesture(state.current, event)
    state.current = step.state
    if (step.longPress === false) clearTimeout(timer.current)
    if (step.longPress === true) {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => latestFeed.current({ type: 'long-press', at: Date.now() }, null), LONG_PRESS_MS)
    }
    run(step.outputs, cell)
  }, [run])

  useEffect(() => {
    latestFeed.current = feed
  }, [feed])

  useEffect(() => () => clearTimeout(timer.current), [])

  const dragging = () => Object.keys(state.current.pointers).length > 0

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      // The right button is a question (onContextMenu), not a place.
      if (event.button === 2) return
      lastType.current = event.pointerType
      event.currentTarget.setPointerCapture?.(event.pointerId)
      event.currentTarget.focus()
      feed({ type: 'down', id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now() }, cellAt(event))
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (dragging()) {
        feed({ type: 'move', id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now() }, cellAt(event))
      } else if (hover && event.pointerType === 'mouse') {
        const cell = cellAt(event)
        if (cell) point(cell, false)
      }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (!dragging()) return
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      feed({ type: event.type === 'pointercancel' ? 'cancel' : 'up', id: event.pointerId, at: Date.now() }, null)
    },
    onPointerLeave() {
      if (!dragging()) onLeave()
    },
    onContextMenu(event: MouseEvent<HTMLElement>) {
      event.preventDefault()
      // A long press on a touch screen also raises a context menu; the long press has already asked.
      if (lastType.current !== 'touch') dispatch({ type: 'query' })
    },
  }
}

/** Polls a standard gamepad while this is mounted and one is connected, and dispatches what its buttons and left stick do. */
export function useGamepad(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return
    let frame = 0
    let pad: PadState = START_PAD
    const standard = () => Array.from(navigator.getGamepads()).find(candidate => isStandardPad(candidate)) ?? null

    const poll = () => {
      const current = standard()
      if (!current) {
        pad = START_PAD
        frame = 0
        return
      }
      const step = stepGamepad(pad, { buttons: current.buttons.map(button => button.pressed), axes: [...current.axes] }, performance.now())
      pad = step.state
      for (const action of step.actions) dispatch(action)
      frame = requestAnimationFrame(poll)
    }
    const start = () => {
      if (frame === 0 && standard()) frame = requestAnimationFrame(poll)
    }
    start()
    window.addEventListener('gamepadconnected', start)
    return () => {
      window.removeEventListener('gamepadconnected', start)
      cancelAnimationFrame(frame)
      frame = 0
    }
  }, [enabled])
}
