// Echo, docked bottom right on every page (docs/tickets/JB01-mascot-dock.md). A button opens a small panel: a speech bubble with the tip, then Talk to
// Echo, Show me around and Turn Echo off. No sound and no speech of its own: a tip waits until the listener opens the bubble, and is then announced once.
// Hidden while the voice guide is open, and when the listener turned Echo off. Echo's visor follows the app (expressionFor.ts).
// The open data set colours Echo and picks its jet trail (accent.ts, JB04): set on the dock as --mascot-* variables and data-trail.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Button, useAnnounce } from '../../components'
import { Echo } from '../../components/Mascot'
import type { MascotPose } from '../../components/mascotTypes'
import type { Visualization } from '../../data'
import type { AssistantStatus } from '../../hooks/useVoiceAssistant'
import type { Page } from '../../pages'
import { setMascotOn, useMascotOn } from '../help/mascotSetting'
import { TIPS } from '../help/tips'
import { MASCOT_NAME } from '../welcome/lines'
import { mascotTheme } from './accent'
import { expressionFor } from './expressionFor'
import { placeBubble } from './placeBubble'
import { useFaceState } from './useFaceState'
import { useLevels } from './useLevels'
import { useMascotGuide, useMascotGuideState } from './useMascotGuide'
import './mascot-dock.css'

type Props = {
  page: Page
  /** A data set is loading. */
  loading: boolean
  voice: AssistantStatus
  /** The voice panel is open: the dock steps aside. */
  voiceOpen: boolean
  /** Opens the voice guide. */
  onTalk: () => void
  /** Starts the tour (JB05). Without it, "Show me around" is not shown. */
  onTour?: () => void
  /** The open data set: its manifest colours Echo and picks the trail (JB04). Null or left out while loading: Echo keeps its own colours. */
  visualization?: Pick<Visualization, 'colorScale' | 'mascot'> | null
}

const poseFor = (voice: AssistantStatus): MascotPose =>
  voice === 'speaking' ? 'talking' : voice === 'listening' ? 'listening' : voice === 'connecting' ? 'thinking' : 'idle'

/** How far the tail stays from the bubble's corners. */
const TAIL_INSET = 24

type CssVars = CSSProperties & Record<`--${string}`, string>

/** The accent on the boots, headphones and trail, and a lighter mix of it for the nozzles and the unlit LEDs. */
function themeStyle(accent: string): CssVars {
  return { '--mascot-accent': accent, '--mascot-accent-soft': `color-mix(in srgb, ${accent} 55%, #ffffff)`, '--mascot-trail': accent }
}

export default function MascotDock({ page, loading, voice, voiceOpen, onTalk, onTour, visualization }: Props) {
  const mascotOn = useMascotOn()
  const announce = useAnnounce()
  const { tip } = useMascotGuideState()
  const { clearTip } = useMascotGuide()
  const face = useFaceState()
  const chest = useLevels(mascotOn && !voiceOpen && face.playing && !face.hidden)
  const [open, setOpen] = useState(false)
  /** The text in the bubble, fixed when it opened (a tip that waited is cleared then, so the button stops saying it has one). */
  const [shown, setShown] = useState('')
  /** The name label under hover or focus; Esc dismisses it (WCAG 1.4.13). */
  const [hint, setHint] = useState(false)
  const panelId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)

  // The voice panel took over: the bubble closes (state adjusted while rendering, not in an effect).
  if (voiceOpen && open) setOpen(false)

  const expression = expressionFor({ loading, voice, playing: face.playing, tipMood: tip?.mood, idleMs: face.idleMs, hidden: face.hidden })
  const name = tip ? `${MASCOT_NAME}, your guide, has a tip` : `${MASCOT_NAME}, your guide`

  /** Puts the bubble beside the helmet. Writes to the element, so a scroll or resize costs no render. */
  const reposition = useCallback(() => {
    const from = button.current
    const bubble = panel.current
    if (!from || !bubble) return
    const anchor = from.getBoundingClientRect()
    const place = placeBubble(anchor, { w: bubble.offsetWidth, h: bubble.offsetHeight }, { w: window.innerWidth, h: window.innerHeight })
    bubble.style.left = `${place.x}px`
    bubble.style.top = `${place.y}px`
    bubble.dataset.side = place.side
    const across = place.side === 'above' || place.side === 'below'
    const tail = across ? anchor.left + anchor.width / 2 - place.x : anchor.top + anchor.height / 2 - place.y
    const length = across ? bubble.offsetWidth : bubble.offsetHeight
    bubble.style.setProperty('--tail', `${Math.min(length - TAIL_INSET, Math.max(TAIL_INSET, tail))}px`)
  }, [])

  // Before paint when it opens, then on resize and scroll, at most once a frame.
  useLayoutEffect(() => {
    if (!open || voiceOpen) return
    reposition()
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(reposition)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule)
    }
  }, [open, voiceOpen, shown, reposition])

  // Esc drops the name label wherever focus is: a listener using only the mouse has focus elsewhere (WCAG 1.4.13).
  useEffect(() => {
    if (!hint) return
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setHint(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hint])

  if (!mascotOn || voiceOpen) return null

  const theme = visualization ? mascotTheme(visualization) : null

  function close() {
    setOpen(false)
    button.current?.focus()
  }

  function toggle() {
    if (open) { close(); return }
    const text = tip?.text ?? TIPS[page]
    setShown(text)
    announce(text)
    if (tip) clearTip()
    setHint(false)
    setOpen(true)
  }

  /** Esc closes an open bubble (and stays inside the dock, so the player's own Esc does not also run). */
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) { event.stopPropagation(); close() }
  }

  function talk() {
    setOpen(false)
    onTalk()
  }

  function tour() {
    setOpen(false)
    onTour?.()
  }

  function turnOff() {
    // The dock is about to go, so focus moves to the help button, which is the way back.
    document.querySelector<HTMLElement>('.help > button')?.focus()
    setMascotOn(false)
    announce(`${MASCOT_NAME} is off. To bring ${MASCOT_NAME} back, open Help and choose Turn ${MASCOT_NAME} on.`)
  }

  return (
    <div
      className="mascot-dock"
      style={theme ? themeStyle(theme.accent) : undefined}
      data-trail={theme?.trail}
      onKeyDown={onKeyDown}
      onPointerEnter={() => setHint(true)}
      onPointerLeave={() => setHint(false)}
      onFocus={() => setHint(true)}
      onBlur={() => setHint(false)}
    >
      {open && (
        <section id={panelId} ref={panel} className="mascot-speech-bubble" aria-label={`${MASCOT_NAME}, your guide`}>
          <p>{shown}</p>
          <div className="mascot-speech-bubble__actions">
            <Button variant="primary" onClick={talk}>Talk to {MASCOT_NAME}</Button>
            {onTour && <Button onClick={tour}>Show me around</Button>}
            <Button variant="text" onClick={turnOff}>Turn {MASCOT_NAME} off</Button>
          </div>
        </section>
      )}
      {hint && !open && <span className="mascot-dock__label" aria-hidden="true">{MASCOT_NAME}, your guide</span>}
      <button ref={button} type="button" className="mascot-dock__button" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={name} onClick={toggle}>
        <Echo className="mascot-dock__echo" pose={poseFor(voice)} expression={expression} levels={chest.levels ?? undefined} globeSpin={chest.loudness} />
        {tip && <span className="mascot-dock__tip-dot" aria-hidden="true" />}
      </button>
    </div>
  )
}
