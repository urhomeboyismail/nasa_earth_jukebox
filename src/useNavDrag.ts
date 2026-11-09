// Drag along the phone tab bar to change page (idea from the Wear&Go app): the glass highlight follows the thumb and the
// page opens on release. Only below 768 px, where the navigation is the bottom bar. A tap still follows the link as
// normal, and keyboard and screen-reader users use the links themselves, so the drag is a shortcut, never the only way.
import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'

const PHONE = '(max-width: 767.98px)'
/** Movement in px before a press counts as a drag; a mostly vertical move hands the gesture back to the page. */
const SLOP = 8
/** The bar's inner padding in px (App.css), so positions are measured from the first tab's edge. */
const PAD = 6

type Gesture = { id: number; x: number; y: number; dragged: boolean }

export function useNavDrag(count: number, onSelect: (index: number) => void) {
  const gesture = useRef<Gesture | null>(null)
  const suppressClickUntil = useRef(0)
  const frame = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)

  /** Where the pointer is along the bar, in tabs: 0 is the middle of the first tab, count - 1 the middle of the last. */
  function position(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const cell = (box.width - 2 * PAD) / count
    return Math.max(0, Math.min(count - 1, (event.clientX - box.left - PAD - cell / 2) / cell))
  }

  function clear(node?: HTMLElement) {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    gesture.current = null
    node?.style.removeProperty('--drag-index')
    setDragging(false)
    setPreview(null)
  }

  return {
    dragging,
    /** The tab under the thumb while dragging, so it can look selected before the page changes. */
    preview,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (!event.isPrimary || event.button !== 0 || !window.matchMedia?.(PHONE).matches) return
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false }
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const start = gesture.current
        if (!start || start.id !== event.pointerId) return
        const dx = event.clientX - start.x, dy = event.clientY - start.y
        if (!start.dragged) {
          if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) return clear(event.currentTarget)
          if (Math.abs(dx) < SLOP) return
          start.dragged = true
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragging(true)
        }
        const at = position(event), node = event.currentTarget
        setPreview(Math.round(at))
        if (frame.current === null) frame.current = requestAnimationFrame(() => {
          node.style.setProperty('--drag-index', String(at))
          frame.current = null
        })
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        const start = gesture.current
        if (!start || start.id !== event.pointerId) return
        if (start.dragged) {
          // The release also fires a click on the link under the thumb; the page is chosen here instead.
          suppressClickUntil.current = Date.now() + 350
          onSelect(Math.round(position(event)))
        }
        clear(event.currentTarget)
      },
      onPointerCancel(event: PointerEvent<HTMLElement>) { clear(event.currentTarget) },
      onClickCapture(event: MouseEvent<HTMLElement>) {
        if (Date.now() < suppressClickUntil.current) {
          event.preventDefault()
          event.stopPropagation()
        }
      },
    },
  }
}
