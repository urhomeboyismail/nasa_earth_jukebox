// The first-minute game's state (ticket IX11). It listens to the same actions every key, touch and gamepad button makes (IX01) and to the find game's first
// target found (IX04), and moves on through the steps in steps.ts. It adds no key and no DOM listener. Each step met plays the lock chime and is announced once.
// An action only counts while the sound map is on: with it off the action does nothing, so it would teach nothing. A move counts only if it lands on another place.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAnnounce } from '../../components'
import { variableWords, type Visualization } from '../../data'
import type { Ensemble } from '../../audio/ensemble/types'
import { createFeedback, type FeedbackEnsemble } from '../../interaction/feedback'
import { useActionHandler } from '../../interaction/registry'
import { presetFor } from '../../sonify'
import type { ExplorerState } from '../explore/useExplorer'
import { resetOnboarding, saveOnboardingDone, useOnboardingDone } from './store'
import { START, STEP_IDS, advance, isDone, landsOnAnotherPlace, promptFor, type GameEvent, type Progress } from './steps'

/** What the game needs of the sound map. */
export type OnboardingExplorer = Pick<ExplorerState, 'on' | 'cursor' | 'grid'> & { ensemble: FeedbackEnsemble & Pick<Ensemble, 'status'> }

type Options = {
  visualization: Visualization
  explorer: OnboardingExplorer
  /** The find game's status; the step after it is met when a target is found. */
  findStatus: string
}

export type Onboarding = ReturnType<typeof useOnboarding>

export const DONE_TEXT = 'Done. You have tried all four. Keep exploring, or press Close.'

export function useOnboarding({ visualization, explorer, findStatus }: Options) {
  const announce = useAnnounce()
  const done = useOnboardingDone()
  const words = variableWords(visualization.variable)
  const preset = useMemo(() => presetFor(visualization.sonification?.preset ?? 'major'), [visualization])
  const [progress, setProgress] = useState<Progress>(START)
  /** Closed by the Close button after the last step. Skipping is remembered instead (the stored flag). */
  const [closed, setClosed] = useState(false)
  /** The step whose change was already announced, so a step is announced once. */
  const announced = useRef(0)
  /** The panel shows while the game is running, and after the last step until Close. A skipped or closed game counts nothing. */
  const visible = !closed && (isDone(progress) || !done)
  const latest = useRef({ explorer, preset, visible })
  useEffect(() => { latest.current = { explorer, preset, visible } })

  const record = useCallback((event: GameEvent) => {
    if (latest.current.visible) setProgress(now => advance(now, event))
  }, [])

  // The same actions the map answers. Nothing is counted while the map is off.
  useActionHandler('move', action => {
    const { on, cursor, grid } = latest.current.explorer
    if (on && grid && landsOnAnotherPlace(action, cursor, grid)) record(action)
  })
  useActionHandler('query', action => { if (latest.current.explorer.on) record(action) })
  useActionHandler('lock', action => { if (latest.current.explorer.on) record(action) })
  useActionHandler('scrubTime', record)

  // IX04: the first target found, seen as the find game's status changes while rendering.
  const [seenFind, setSeenFind] = useState(findStatus)
  if (seenFind !== findStatus) {
    setSeenFind(findStatus)
    if (findStatus === 'found' && visible) setProgress(now => advance(now, { type: 'found' }))
  }

  // A step met: the lock chime and one announcement. The finished game is remembered, so it is not offered again on its own.
  const step = progress.step
  useEffect(() => {
    if (step <= announced.current) return
    announced.current = step
    const { explorer: map, preset: notes } = latest.current
    if (map.ensemble.status() === 'on') createFeedback(map.ensemble, notes).lock({ position: 0.5, pan: 0 })
    const id = STEP_IDS[step]
    announce(id === undefined ? DONE_TEXT : `Step ${step + 1} of ${STEP_IDS.length}. ${promptFor(id, words)}`)
    if (id === undefined) saveOnboardingDone()
  }, [step, announce, words])

  const finished = isDone(progress)
  const id = STEP_IDS[step]

  return {
    visible,
    step,
    steps: STEP_IDS.length,
    finished,
    prompt: id === undefined ? DONE_TEXT : promptFor(id, words),
    /** The first step cannot be done with the map off. */
    mapOff: !explorer.on,
    /** Skip: not offered again on its own. */
    skip: saveOnboardingDone,
    close: () => setClosed(true),
    /** The game again, from the first step. */
    restart: () => {
      announced.current = 0
      setProgress(START)
      setClosed(false)
      resetOnboarding()
    },
    /** For an event that is not an action, such as the date slider. */
    record,
  }
}
