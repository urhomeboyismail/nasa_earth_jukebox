// "Help from Echo" (F37 T2): a button in the same place on every page (WCAG 3.2.6) that opens one tip for the page. Inline, so
// nothing floats over the bottom bar or the voice guide. It can bring the welcome back and turn the mascot off.

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button, useAnnounce } from '../../components'
import { RobotBadge } from '../../components/RobotBadge'
import type { Page } from '../../pages'
import { LANDING_HASH } from '../../route'
import { MASCOT_NAME } from '../welcome/lines'
import { setMascotOn, useMascotOn } from './mascotSetting'
import { TIPS } from './tips'
import './help.css'

export function HelpButton({ page }: { page: Page }) {
  const announce = useAnnounce()
  const mascotOn = useMascotOn()
  const [open, setOpen] = useState(false)
  const panel = useId()
  const wrapper = useRef<HTMLDivElement>(null)
  const label = mascotOn ? `Help from ${MASCOT_NAME}` : 'Help'

  function close() {
    setOpen(false)
    wrapper.current?.querySelector('button')?.focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') { event.stopPropagation(); close() }
  }

  function showWelcome() {
    setMascotOn(true)
    announce('The welcome is open.')
    window.location.hash = LANDING_HASH
    close()
  }

  function switchMascot() {
    setMascotOn(!mascotOn)
    announce(mascotOn ? `${MASCOT_NAME} is off.` : `${MASCOT_NAME} is on.`)
  }

  return (
    <div ref={wrapper} className="help" onKeyDown={onKeyDown}>
      <Button aria-expanded={open} aria-controls={panel} onClick={() => (open ? close() : setOpen(true))}>
        {mascotOn && <RobotBadge size={24} className="help__mascot" />}
        {label}
      </Button>
      {open && (
        <section id={panel} className="help__panel" aria-label={label}>
          <p>{TIPS[page]}</p>
          <div className="help__actions">
            <Button onClick={showWelcome}>Show the welcome again</Button>
            <Button onClick={switchMascot}>{mascotOn ? `Turn ${MASCOT_NAME} off` : `Turn ${MASCOT_NAME} on`}</Button>
            <Button variant="text" onClick={close}>Close help</Button>
          </div>
        </section>
      )}
    </div>
  )
}
