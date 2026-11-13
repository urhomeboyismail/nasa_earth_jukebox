// Scrubbing time by ear (ticket IX06). A `scrubTime` action (the arrow keys, Home and End as the shortcut list binds them, the gamepad's D-pad) moves the date and, when
// the dates are not playing, sounds a 150 ms slice of the target date's music through the ensemble's `playNotes`, so each step is heard.
//
//  - While the dates are playing, or a hot spot is being followed, the step is what it was before: the sequence carries on from the new date (`chooseDate`).
//  - Otherwise the date changes silently on screen (`showDate`) and the slice is the sound. The date is also announced, and a step that cannot move says which end it is at.
//  - The slice starts in the same tick as the key when the date's music is ready (it is read for the dates either side of the one on screen, ahead of time), and at most
//    SCRUB_STEPS_PER_SECOND times a second when a key is held. The dates move on every repeat. Nothing sounds before a key press (WCAG 1.4.2).
//
// The music is read from the checked frame (SN08's `scanFeatures`: a frame on its own) and turned into notes with SN03's ruleset. State is only the refs: nothing here renders.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { FrameFeatures } from '../../analysis/features/types'
import type { Ensemble } from '../../audio/ensemble/types'
import { useAnnounce } from '../../components'
import type { Frame, Visualization } from '../../data'
import { useActionHandler } from '../../interaction/registry'
import { presetFor, toMusicFrame, type MusicFrame } from '../../sonify'
import { endWords, scrubTarget, sliceDue, sliceNotes } from './scrub'
import { scanFeatures } from './scanFeatures'

export type ScrubEnsemble = Pick<Ensemble, 'playNotes' | 'status' | 'start'>

type Options = {
  visualization: Visualization
  /** The date on screen. */
  index: number
  ensemble: ScrubEnsemble
  /** The dates are playing, or a hot spot is followed: the step goes the way it did before, with no slice. */
  carryOn: () => boolean
  /** The step as it was before the slice: the sequence plays on from the new date. */
  chooseDate: (index: number) => void
  /** A silent change of the date on screen. */
  showDate: (index: number) => void
  /** The date in words, as the date slider says it. */
  formatDate: (date: string) => string
  /** After a slice date was chosen (the vibration pulse). */
  onStep?: (index: number) => void
  /** How a date's features are read. For tests; the app's reader by default. */
  read?: (visualization: Visualization, frame: Frame) => Promise<FrameFeatures>
  /** The clock, in milliseconds. For tests. */
  clock?: () => number
}

/** The dates next to the one on screen, and the two ends: where a key is likely to go next. */
const nextTo = (index: number, length: number) => [index + 1, index - 1, 0, length - 1].filter((i, at, all) => i >= 0 && i < length && all.indexOf(i) === at)

export function useScrub({ visualization, index, ensemble, carryOn, chooseDate, showDate, formatDate, onStep, read = scanFeatures, clock = () => performance.now() }: Options) {
  const announce = useAnnounce()
  const { frames } = visualization
  const preset = useMemo(() => presetFor(visualization.sonification?.preset ?? 'major'), [visualization.sonification?.preset])
  /** Each date's music, by `<data set>:<index>`, once read. */
  const music = useRef(new Map<string, MusicFrame>())
  const reading = useRef(new Map<string, Promise<MusicFrame | null>>())
  /** Bumped by every step, so a slice whose date was still being read when a newer step came is not played late. */
  const latest = useRef(0)
  const lastSliceAt = useRef<number | null>(null)
  const keyOf = useCallback((i: number) => `${visualization.id}:${i}`, [visualization.id])

  const load = useCallback((i: number): Promise<MusicFrame | null> => {
    const key = keyOf(i)
    const kept = reading.current.get(key)
    if (kept) return kept
    const started = read(visualization, frames[i]).then(
      features => {
        const frame = toMusicFrame(features, preset)
        music.current.set(key, frame)
        return frame
      },
      () => {
        // A failed read is not kept, so the next step tries again.
        reading.current.delete(key)
        return null
      },
    )
    reading.current.set(key, started)
    return started
  }, [frames, keyOf, preset, read, visualization])

  // The dates a step can land on next are read ahead, so the slice sounds with the key and not after the picture is read.
  useEffect(() => {
    for (const i of nextTo(index, frames.length)) void load(i)
  }, [index, frames.length, load])

  /** Sounds the slice of date `i`: at once when it is ready and the sound is on, otherwise as soon as both are. */
  const slice = useCallback((i: number, step: number) => {
    const now = clock()
    if (!sliceDue(lastSliceAt.current, now)) return
    const ready = music.current.get(keyOf(i))
    if (ready && ensemble.status() === 'on') {
      lastSliceAt.current = now
      ensemble.playNotes(sliceNotes(ready))
      return
    }
    // The key press is what starts the sound; the slice follows when it is on and the date has been read.
    void (async () => {
      const started = ensemble.status() === 'on' ? undefined : ensemble.start().catch(() => {})
      const [frame] = await Promise.all([ready ?? load(i), started])
      if (!frame || step !== latest.current || ensemble.status() !== 'on') return
      lastSliceAt.current = clock()
      ensemble.playNotes(sliceNotes(frame))
    })()
  }, [clock, ensemble, keyOf, load])

  useActionHandler('scrubTime', action => {
    const length = frames.length
    const target = scrubTarget(index, action, length)
    const step = ++latest.current
    if (target === index) {
      // Nowhere to go: said in words, once, with no sound and no change.
      const words = endWords(index, target, length)
      if (words) announce(words)
      return
    }
    if (carryOn()) {
      chooseDate(target)
      return
    }
    showDate(target)
    onStep?.(target)
    announce(formatDate(frames[target].date))
    slice(target, step)
  })

  // Escape drops a slice that is still waiting for its date or for the sound. One that is sounding lets go by itself within SLICE_SECONDS.
  useActionHandler('stopSpeech', () => { latest.current++ })
}
