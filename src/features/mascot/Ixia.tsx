// The 3D robot that draws Echo (JB08): the myt Learning Hub's <robot-companion>, vendored in public/robot/. It is only a picture of the guide.
// Echo's words, buttons, tips and voice are all ours: the robot's own chat, tips and greetings are off (`quiet`, empty config), a click on it
// opens our guide, and it is hidden from screen readers and the Tab order because the dock button and the status text say the same in words.
// Our state drives it: the expression picks its face, the pose a gesture, and the guide's spoken line is typed into its bubble as the voice says it.

import { useEffect, useRef, useState } from 'react'
import type { MascotExpression, MascotPose } from '../../components/mascotTypes'
import type { RobotCompanionElement } from '../../types/robot-companion'
import { MASCOT_NAME } from '../welcome/lines'
import { FACE_FOR, GESTURE_FOR, loadRobot, nextLine, ROBOT_LOGO, ROBOT_THREE, SPEAK_CPS } from './robot'

type Props = {
  pose: MascotPose
  expression: MascotExpression
  /** The line the guide is saying now, growing as it speaks. Empty when it is quiet. */
  say?: string
  /** A click on the robot: opens the voice guide. */
  onActivate?: () => void
  className?: string
}

/** The robot's own lines, tips and chat, all off: Echo speaks only through the app. */
const QUIET_CONFIG = { name: MASCOT_NAME, faq: [], tips: [], pages: {}, lines: [], pokes: [], invitations: [], featured: [] }

export default function Ixia({ pose, expression, say = '', onActivate, className }: Props) {
  const host = useRef<RobotCompanionElement>(null)
  const [ready, setReady] = useState(false)
  const activate = useRef(onActivate)
  const speech = useRef({ said: '', latest: '', busy: false })

  useEffect(() => { activate.current = onActivate }, [onActivate])

  // The script loads after the first render, once for the whole app.
  useEffect(() => {
    let live = true
    void loadRobot().then(ok => { if (live && ok) setReady(true) })
    return () => { live = false }
  }, [])

  // Once defined: its own voice off, out of the Tab order, and a click comes to us.
  useEffect(() => {
    const el = host.current
    if (!ready || !el) return
    el.configure(QUIET_CONFIG)
    // Its body and its corner button (shown when it steps aside) stay out of the Tab order: the dock's button is the keyboard's way in.
    el.shadowRoot?.querySelectorAll('.hit, .dock').forEach(part => part.setAttribute('tabindex', '-1'))
    const onClick = (event: Event) => {
      event.preventDefault()
      activate.current?.()
    }
    el.addEventListener('robot-click', onClick)
    return () => el.removeEventListener('robot-click', onClick)
  }, [ready])

  useEffect(() => {
    if (ready) host.current?.face(FACE_FOR[expression], Infinity)
  }, [ready, expression])

  useEffect(() => {
    const el = host.current
    if (!ready || !el) return
    const gesture = GESTURE_FOR[pose]
    if (gesture) void el.gesture(gesture)
    else el.stopGesture()
  }, [ready, pose])

  // The spoken line, a piece at a time: each new part is typed when the last is done, so the mouth moves for as long as the voice talks.
  useEffect(() => {
    const el = host.current
    if (!ready || !el) return
    const state = speech.current
    state.latest = say
    if (!say) {
      if (state.said) el.hush()
      state.said = ''
      state.busy = false
      return
    }
    const pump = () => {
      if (state.busy) return
      const line = nextLine(state.said, state.latest)
      if (!line) return
      state.said = state.latest
      state.busy = true
      void el.say(line, { speed: SPEAK_CPS, hold: 4000 }).finally(() => {
        state.busy = false
        pump()
      })
    }
    pump()
  }, [ready, say])

  return (
    <robot-companion
      ref={host}
      className={className}
      data-pose={pose}
      data-expression={expression}
      data-say={say}
      three={ROBOT_THREE}
      logo={ROBOT_LOGO}
      bubble="left"
      quiet
      aria-hidden="true"
    />
  )
}
