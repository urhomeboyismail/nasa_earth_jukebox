// The player's state and its link to the sound engine. Keeping the image, the slider and the sound on the same
// date is the whole job: every change of date goes through here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzeAll, type FrameAnalysis } from '../../analysis'
import { createSoundEngine, type SoundEngine } from '../../audio'
import { useAnnounce } from '../../components/useAnnounce'
import type { Visualization } from '../../data'
import { dateFormatterFor } from '../../dates'
import { onPlayerCommand } from './controls'

export type Speed = 'slow' | 'normal' | 'fast'
export type Status = 'idle' | 'playing' | 'paused'

/** Time between dates. */
export const STEP_MS: Record<Speed, number> = { slow: 1600, normal: 1000, fast: 500 }

/** `onDate` is called each time the player lands on a date: at every step of a sequence, and when one date is played alone. */
export function usePlayer(visualization: Visualization, onDate?: (index: number, category: string | null) => void) {
  const { frames, regions, colorScale, mapping } = visualization
  const region = regions[0]
  const announce = useAnnounce()
  const formatDate = useMemo(() => dateFormatterFor(frames.map(frame => frame.date)), [frames])

  const [results, setResults] = useState<FrameAnalysis[] | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<Status>('idle')
  const [speed, setSpeedState] = useState<Speed>('normal')
  const [volume, setVolumeState] = useState(0.8)
  const [finished, setFinished] = useState(false)

  const { engine, engineError } = useMemo((): { engine: SoundEngine | null; engineError: string } => {
    try {
      return { engine: createSoundEngine(mapping), engineError: '' }
    } catch (error) {
      return { engine: null, engineError: error instanceof Error ? error.message : String(error) }
    }
  }, [mapping])

  // Analyze every frame once, when the page opens. The page remounts for another visualization, so nothing is stale.
  useEffect(() => {
    let cancelled = false
    analyzeAll(frames, region, colorScale, mapping)
      .then(done => { if (!cancelled) setResults(done) })
      .catch((error: unknown) => { if (!cancelled) setAnalysisError(error instanceof Error ? error.message : String(error)) })
    return () => { cancelled = true }
  }, [frames, region, colorScale, mapping])

  // Preload the next image so stepping forward never waits.
  useEffect(() => {
    const next = frames[index + 1]
    if (next) new Image().src = next.image
  }, [frames, index])

  // Each play gets a number. Anything a finished or replaced run still has pending checks it and does nothing.
  const run = useRef(0)
  const endTimer = useRef<number | undefined>(undefined)
  const lastSpoken = useRef(-1)
  const volumeRef = useRef(volume)
  const onDateRef = useRef(onDate)
  useEffect(() => { onDateRef.current = onDate })

  const labelFor = useCallback((i: number) => {
    const category = results?.[i]?.category
    if (!category) return ''
    return category === 'insufficient' ? 'no data' : (mapping.categories.find(c => c.id === category)?.label ?? category).toLowerCase()
  }, [results, mapping])

  /** "March 2024: warm" (the date as detailed as the dataset needs). Said once per date unless `force` is set (Replay says it again on purpose). */
  const describeDate = useCallback((i: number) => `${formatDate(frames[i].date)}: ${labelFor(i)}`, [frames, formatDate, labelFor])
  const speak = useCallback((i: number, force = false) => {
    if (!force && lastSpoken.current === i) return
    lastSpoken.current = i
    announce(describeDate(i))
  }, [announce, describeDate])

  const cancelRun = useCallback(() => {
    run.current++
    window.clearTimeout(endTimer.current)
  }, [])

  // Silence everything when leaving the page.
  useEffect(() => () => { run.current++; window.clearTimeout(endTimer.current); engine?.stop() }, [engine])

  const ready = !!engine && !!results && results.length === frames.length

  /** Plays dates from `from` to the end. Needs a click or key press, which is where every caller comes from. */
  const startFrom = useCallback(async (from: number, speedNow: Speed) => {
    if (!engine || !results) return
    cancelRun()
    const mine = run.current
    await engine.unlock()
    if (mine !== run.current) return
    engine.setVolume(volumeRef.current)
    engine.stop()
    const stepMs = STEP_MS[speedNow]
    const steps = frames.slice(from).map((_, k) => ({ category: results[from + k].category, atMs: k * stepMs }))
    setFinished(false)
    setStatus('playing')
    engine.playSequence(steps, k => {
      if (mine !== run.current) return
      setIndex(from + k)
      speak(from + k)
      onDateRef.current?.(from + k, results[from + k].category)
      if (k === steps.length - 1) {
        endTimer.current = window.setTimeout(() => {
          if (mine !== run.current) return
          setStatus('idle')
          setFinished(true)
        }, stepMs)
      }
    })
  }, [engine, results, frames, speak, cancelRun])

  /** Sounds one date on its own and leaves the player stopped there. */
  const playOne = useCallback(async (i: number, force = false) => {
    if (!engine || !results) return
    cancelRun()
    const mine = run.current
    await engine.unlock()
    if (mine !== run.current) return
    engine.setVolume(volumeRef.current)
    engine.stop()
    setStatus('idle')
    setIndex(i)
    speak(i, force)
    onDateRef.current?.(i, results[i].category)
    engine.playSequence([{ category: results[i].category, atMs: 0 }], () => {})
  }, [engine, results, speak, cancelRun])

  const play = useCallback(() => {
    if (!ready) return
    if (status === 'paused') {
      setStatus('playing')
      engine.resume()
    } else if (status === 'idle') {
      void startFrom(index >= frames.length - 1 ? 0 : index, speed)
    }
  }, [ready, status, engine, startFrom, index, frames.length, speed])

  const pause = useCallback(() => {
    if (status !== 'playing') return
    engine?.pause()
    setStatus('paused')
  }, [status, engine])

  const stop = useCallback(() => {
    cancelRun()
    engine?.stop()
    setStatus('idle')
    setIndex(0)
    lastSpoken.current = -1
  }, [engine, cancelRun])

  const replay = useCallback(() => {
    if (ready) void playOne(index, true)
  }, [ready, playOne, index])

  /** Jump to a date: while playing the sequence carries on from there; otherwise that date plays on its own. */
  const goTo = useCallback((i: number) => {
    if (!ready) return
    const clamped = Math.min(frames.length - 1, Math.max(0, i))
    if (status === 'playing') {
      setIndex(clamped)
      speak(clamped)
      void startFrom(clamped, speed)
    } else {
      void playOne(clamped)
    }
  }, [ready, frames.length, status, speed, startFrom, playOne, speak])

  const setSpeed = useCallback((next: Speed) => {
    setSpeedState(next)
    if (status === 'playing') void startFrom(index, next)
  }, [status, index, startFrom])

  const setVolume = useCallback((next: number) => {
    volumeRef.current = next
    setVolumeState(next)
    engine?.setVolume(next)
  }, [engine])

  // Commands from the voice guide. The listener is registered once and always calls the latest handlers.
  const latest = useRef({ play, pause, stop, replay, goTo, index })
  useEffect(() => { latest.current = { play, pause, stop, replay, goTo, index } })
  useEffect(() => onPlayerCommand(command => {
    const current = latest.current
    if (command === 'play') current.play()
    else if (command === 'pause') current.pause()
    else if (command === 'stop') current.stop()
    else if (command === 'replay') current.replay()
    else if (command === 'next') current.goTo(current.index + 1)
    else if (command === 'previous') current.goTo(current.index - 1)
    else {
      const target = frames.findIndex(frame => frame.date === command.setDate)
      if (target >= 0) current.goTo(target)
    }
  }), [frames])

  return {
    region, results, index, status, speed, volume, finished, ready,
    error: engineError || analysisError,
    loading: !engineError && !analysisError && !results,
    play, pause, stop, replay, goTo, setSpeed, setVolume,
    describeDate, formatDate,
    categoryAt: (i: number) => results?.[i]?.category ?? null,
  }
}
