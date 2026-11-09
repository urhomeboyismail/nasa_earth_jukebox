import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { Button } from './Button'

type Props = {
  open: boolean
  /** Called for Escape, the Close button and a click outside. The caller sets `open` to false. */
  onClose: () => void
  /** The heading, which also names the dialog. */
  title: string
  children: ReactNode
}

/**
 * A native `<dialog>`, opened modally: the page behind it cannot be reached, Tab stays inside, and the rest of the page is hidden from
 * a screen reader. Focus moves to the heading when it opens (so it is read first) and returns to what had it before when it closes.
 * Where `showModal` does not exist (jsdom) it falls back to the `open` attribute, so tests can see the content.
 */
export function Dialog({ open, onClose, title, children }: Props) {
  const box = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const before = useRef<Element | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = box.current
    if (!dialog) return
    if (open && !dialog.open) {
      before.current = document.activeElement
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      heading.current?.focus()
    } else if (!open) {
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close()
        else dialog.removeAttribute('open')
      }
      if (before.current instanceof HTMLElement) before.current.focus()
      before.current = null
    }
  }, [open])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    // Closed through the caller, so focus goes back in one place whichever way the dialog was closed.
    event.preventDefault()
    onClose()
  }

  // The dialog element itself is only the backdrop: the content sits in a box inside it.
  function onBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <dialog ref={box} className="ui-dialog" aria-labelledby={titleId} onKeyDown={onKeyDown} onClick={onBackdrop} onClose={onClose}>
      <div className="ui-dialog__body">
        <h2 id={titleId} ref={heading} tabIndex={-1} className="ui-dialog__title">{title}</h2>
        {open && children}
        <div className="ui-dialog__actions">
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </dialog>
  )
}
