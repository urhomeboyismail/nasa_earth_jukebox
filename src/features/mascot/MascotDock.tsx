// Echo, docked bottom right on every page (docs/tickets/JB01-mascot-dock.md). A button opens a small panel: a speech bubble with the tip, then Talk to
// Echo, Show me around and Turn Echo off. No sound and no speech of its own: a tip waits until the listener opens the bubble, and is then announced once.
// Echo is drawn by the 3D robot (Ixia.tsx, JB08). A click on the robot opens the bubble; the dock's button does the same from the keyboard and is
// what screen readers find (it shows when focused). The robot moves itself clear of what is under it, so the bubble, the tip dot and the name label
// follow where it is drawn. While the voice guide is open the robot steps beside the panel, mouths what the guide says, and the button goes.
// Gone when the listener turned Echo off.
// Echo's face follows the app (expressionFor.ts). The open data set colours Echo (accent.ts, JB04): set on the dock as --mascot-* variables.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { currentContext, subscribeContext } from '../../assistant/context'
import { Button, useAnnounce } from '../../components'
import type { MascotPose } from '../../components/mascotTypes'
import type { Visualization } from '../../data'
import type { AssistantStatus } from '../../hooks/useVoiceAssistant'
import type { Page } from '../../pages'
import { setMascotOn, useMascotOn } from '../help/mascotSetting'
import { TIPS } from '../help/tips'
import { MASCOT_NAME } from '../welcome/lines'
import { mascotTheme } from './accent'
import { expressionFor } from './expressionFor'
import Ixia from './Ixia'
import { placeBubble } from './placeBubble'
import { useFaceState } from './useFaceState'
import { useMascotGuide, useMascotGuideState } from './useMascotGuide'
import './mascot-dock.css'

type Props = {
  page: Page
  /** A data set is loading. */
  loading: boolean
  voice: AssistantStatus
  /** The voice panel is open: the dock steps aside. */
  voiceOpen: boolean
  /** What the voice guide is saying now (empty when it is quiet): the robot mouths it. */
  line?: string
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

/** JB07: what the sound map publishes on the context bus (useExplorer.ts). */
type ExploreState = { exploring: boolean; position: number | null; here: string }
const NOT_EXPLORING: ExploreState = { exploring: false, position: null, here: '' }

function readExplore(data: unknown): ExploreState {
  if (typeof data !== 'object' || data === null) return NOT_EXPLORING
  const exploring = 'exploring' in data && data.exploring === true
  const position = 'position' in data && typeof data.position === 'number' && Number.isFinite(data.position) ? Math.min(1, Math.max(0, data.position)) : null
  const here = 'here' in data && typeof data.here === 'string' ? data.here : ''
  return exploring ? { exploring, position, here } : NOT_EXPLORING
}

function useExploreState(): ExploreState {
  const [state, setState] = useState(() => readExplore(currentContext().find(item => item.key === 'explore')?.data))
  useEffect(() => subscribeContext(update => { if (update.key === 'explore') setState(readExplore(update.data)) }), [])
  return state
}

/** Where the robot's body is drawn now: the robot's own click target, or the dock's box before the robot has loaded. */
function robotBox(dock: HTMLElement | null): DOMRect | null {
  if (!dock) return null
  const box = dock.querySelector('robot-companion')?.shadowRoot?.querySelector('.hit')?.getBoundingClientRect()
  return box && box.width > 0 ? box : dock.getBoundingClientRect()
}

/** The data set's accent, for the robot's bubble and glow (mascot-dock.css maps it onto the --robot-* variables). */
function themeStyle(accent: string): CssVars {
  return { '--mascot-accent': accent, '--mascot-accent-soft': `color-mix(in srgb, ${accent} 55%, #ffffff)`, '--mascot-trail': accent }
}

export default function MascotDock({ page, loading, voice, voiceOpen, line = '', onTalk, onTour, visualization }: Props) {
  const mascotOn = useMascotOn()
  const announce = useAnnounce()
  const { tip } = useMascotGuideState()
  const { clearTip } = useMascotGuide()
  const face = useFaceState()
  const explore = useExploreState()
  const [open, setOpen] = useState(false)
  /** The page the bubble opened on: a new page closes it (the robot stays, so the dock is not remounted). */
  const [openOn, setOpenOn] = useState(page)
  /** The text in the bubble, fixed when it opened (a tip that waited is cleared then, so the button stops saying it has one). */
  const [shown, setShown] = useState('')
  /** The name label under hover (focus shows the button itself, which carries the name); Esc dismisses it (WCAG 1.4.13). */
  const [hint, setHint] = useState(false)
  const panelId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const label = useRef<HTMLSpanElement>(null)

  // The voice panel took over, or the page changed: the bubble closes (state adjusted while rendering, not in an effect).
  if (open && (voiceOpen || openOn !== page)) setOpen(false)

  const expression = expressionFor({ loading: loading || explore.exploring, voice, playing: face.playing, tipMood: tip?.mood, idleMs: face.idleMs, hidden: face.hidden })
  const name = tip ? `${MASCOT_NAME}, your guide, has a tip` : `${MASCOT_NAME}, your guide`

  /** Puts the bubble beside the robot, the tip dot on its head and the label to its left. Writes to the elements, so following costs no render. */
  const reposition = useCallback(() => {
    const anchor = robotBox(dock.current)
    if (!anchor) return
    if (dot.current) {
      dot.current.style.left = `${anchor.right - 16}px`
      dot.current.style.top = `${anchor.top}px`
    }
    if (label.current) {
      label.current.style.left = `${anchor.left - 8}px`
      label.current.style.top = `${anchor.top + anchor.height / 2}px`
    }
    const bubble = panel.current
    if (!bubble) return
    const place = placeBubble(anchor, { w: bubble.offsetWidth, h: bubble.offsetHeight }, { w: window.innerWidth, h: window.innerHeight })
    bubble.style.left = `${place.x}px`
    bubble.style.top = `${place.y}px`
    bubble.dataset.side = place.side
    const across = place.side === 'above' || place.side === 'below'
    const tail = across ? anchor.left + anchor.width / 2 - place.x : anchor.top + anchor.height / 2 - place.y
    const length = across ? bubble.offsetWidth : bubble.offsetHeight
    bubble.style.setProperty('--tail', `${Math.min(length - TAIL_INSET, Math.max(TAIL_INSET, tail))}px`)
  }, [])

  // Before paint, then once a frame while something follows the robot (it can move at any time, not only on scroll).
  const following = !voiceOpen && (open || tip !== null || hint)
  useLayoutEffect(() => {
    if (!following) return
    let frame = 0
    const tick = () => {
      reposition()
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [following, shown, reposition])

  // Esc closes an open bubble wherever focus is (opened with a click on the robot, focus is still on the page). Caught first and stopped there,
  // so neither the player's own Esc nor the robot's (which would send it away to its corner) also runs. Focus goes back to the button only when
  // it was in the bubble or on the button.
  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      const active = document.activeElement
      const inside = active !== null && (active === button.current || (panel.current?.contains(active) ?? false))
      setOpen(false)
      if (inside) button.current?.focus()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  // Esc drops the name label wherever focus is: a listener using only the mouse has focus elsewhere (WCAG 1.4.13).
  useEffect(() => {
    if (!hint) return
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setHint(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hint])

  if (!mascotOn) return null

  const theme = visualization ? mascotTheme(visualization) : null

  function close() {
    setOpen(false)
    button.current?.focus()
  }

  function toggle() {
    if (open) { close(); return }
    const text = explore.exploring && explore.here ? explore.here : (tip?.text ?? TIPS[page])
    setShown(text)
    announce(text)
    if (tip) clearTip()
    setHint(false)
    setOpenOn(page)
    setOpen(true)
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

  // One tree whether or not the voice panel is open, so the robot is never remounted (its 3D scene is set up once).
  return (
    <div
      ref={dock}
      className={voiceOpen ? 'mascot-dock mascot-dock--beside-voice' : 'mascot-dock'}
      style={theme ? themeStyle(theme.accent) : undefined}
      data-trail={theme?.trail}
      onPointerEnter={() => setHint(true)}
      onPointerLeave={() => setHint(false)}
    >
      <Ixia className="mascot-dock__robot" pose={poseFor(voice)} expression={expression} say={voiceOpen ? line : ''} onActivate={voiceOpen ? undefined : toggle} />
      {open && !voiceOpen && (
        <section id={panelId} ref={panel} className="mascot-speech-bubble" aria-label={`${MASCOT_NAME}, your guide`}>
          <p>{shown}</p>
          <div className="mascot-speech-bubble__actions">
            <Button variant="primary" onClick={talk}>Talk to {MASCOT_NAME}</Button>
            {onTour && <Button onClick={tour}>Show me around</Button>}
            <Button variant="text" onClick={turnOff}>Turn {MASCOT_NAME} off</Button>
          </div>
        </section>
      )}
      {hint && !open && !voiceOpen && <span ref={label} className="mascot-dock__label" aria-hidden="true">{MASCOT_NAME}, your guide</span>}
      {tip && !open && !voiceOpen && <span ref={dot} className="mascot-dock__tip-dot" aria-hidden="true" />}
      {!voiceOpen && (
        <button ref={button} type="button" className="mascot-dock__button" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={toggle}>
          {name}
        </button>
      )}
    </div>
  )
}
