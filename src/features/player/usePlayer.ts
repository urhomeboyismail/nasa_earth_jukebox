// The player's state and its link to the sound engine. Keeping the image, the slider and the sound on the same
// date is the whole job: every change of date goes through here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzeAll, type FrameAnalysis } from '../../analysis'
import { createSoundEngine, type SequenceStep, type SoundEngine } from '../../audio'
import { elevationFor, panFor, useSpatialMode } from '../../audio/pan'
import { useSoundStyle } from '../../audio/style'
import { voicingFor } from '../../audio/voicing'
import { useAnnounce } from '../../components/useAnnounce'
import type { Region, SoundMapping, Visualization } from '../../data'
import { dateFormatterFor } from '../../dates'
import { categoryChanged, playerDateLine, playerStopLine, withUnit, type DateParts, type StopKind } from '../../describe'
import { useDescriptionDetail } from '../../describe/detail'
import { onPlayerCommand } from './controls'

export type Speed = 'slow' | 'normal' | 'fast'
export type Status = 'idle' | 'playing' | 'paused'

/** Time between dates. */
export const STEP_MS: Record<Speed, number> = { slow: 1600, normal: 1000, fast: 500 }

/** One step per date from `from` to `to`: its category, where the region sits (stereo pan and height) and the chord, slide and bell. Pure, so the sound regression test plays exactly what Listen plays. */
export function sequenceSteps(
  results: FrameAnalysis[], region: Pick<Region, 'points'>, mapping: SoundMapping, from: number, to: number, stepMs: number,
): SequenceStep[] {
  const pan = panFor(region)
  const elevation = elevationFor(region)
  return results.slice(from, to + 1).map((result, k) => ({
    category: result.category, atMs: k * stepMs, pan, elevation, ...voicingFor(results, from + k, mapping),
  }))
}

/** `onDate` is called each time the player lands on a date: at every step of a sequence, and when one date is played alone. */
export function usePlayer(visualization: Visualization, onDate?: (index: number, category: string | null) => void) {
  const { frames, regions, colorScale, mapping } = visualization
  const region = regions[0]
  const announce = useAnnounce()
  const [detail] = useDescriptionDetail()
  const formatDate = useMemo(() => dateFormatterFor(frames.map(frame => frame.date)), [frames])

  const [results, setResults] = useState<FrameAnalysis[] | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<Status>('idle')
  const [speed, setSpeedState] = useState<Speed>('normal')
  const [volume, setVolumeState] = useState(0.8)
  const [finished, setFinished] = useState(false)
  const [style, setStyle] = useSoundStyle()
  const [spatial, setSpatial] = useSpatialMode()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const { engine, engineError } = useMemo((): { engine: SoundEngine | null; engineError: string } => {
    try {
      return { engine: createSoundEngine(mapping), engineError: '' }
    } catch (error) {
      return { engine: null, engineError: error instanceof Error ? error.message : String(error) }
    }
  }, [mapping])

  // The sound style (full or simple) is set on the engine whenever it or the style changes.
  useEffect(() => { engine?.setStyle(style) }, [engine, style])
  // Likewise stereo or 3D sound.
  useEffect(() => { engine?.setSpatial(spatial) }, [engine, spatial])

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
  /** The category of the last date said during playback, so a run of equal dates is said once. Null before the first. */
  const lastCategory = useRef<string | null>(null)
  const volumeRef = useRef(volume)
  const onDateRef = useRef(onDate)
  useEffect(() => { onDateRef.current = onDate })

  const labelFor = useCallback((i: number) => {
    const category = results?.[i]?.category
    if (!category) return ''
    return category === 'insufficient' ? 'not enough data' : (mapping.categories.find(c => c.id === category)?.label ?? category).toLowerCase()
  }, [results, mapping])

  /** "March 2024: warm" (the date as detailed as the dataset needs). The slider reads this as its value. */
  const describeDate = useCallback((i: number) => `${formatDate(frames[i].date)}: ${labelFor(i)}`, [frames, formatDate, labelFor])

  /** The pieces of the spoken line for a date (words are built in src/describe/announcements.ts). */
  const partsFor = useCallback((i: number): DateParts => {
    const result = results?.[i]
    return {
      date: formatDate(frames[i].date),
      label: labelFor(i),
      missing: result?.category === 'insufficient',
      value: result?.medianValue === undefined ? undefined : withUnit(result.medianValue, visualization.variable.unit),
      detail,
    }
  }, [results, frames, formatDate, labelFor, visualization.variable.unit, detail])

  /** A date reached during playback: said only when its category differs from the last one said, and at most once per 1.5 s (`busy`). */
  const speakStep = useCallback((i: number) => {
    const category = results?.[i]?.category
    if (!category || !categoryChanged(lastCategory.current, category)) return
    lastCategory.current = category
    announce(playerDateLine(partsFor(i)), { busy: true })
  }, [results, announce, partsFor])

  /** A date the listener asked for (a jump, a replay, one date on its own): always said, at once. */
  const speakNow = useCallback((i: number) => {
    lastCategory.current = results?.[i]?.category ?? null
    announce(playerDateLine(partsFor(i)))
  }, [results, announce, partsFor])

  /** Paused, stopped or finished: the current date, whatever was said before. */
  const speakStop = useCallback((kind: StopKind, i: number) => {
    if (results?.[i]) announce(playerStopLine(kind, partsFor(i)))
  }, [results, announce, partsFor])

  const cancelRun = useCallback(() => {
    run.current++
    window.clearTimeout(endTimer.current)
  }, [])

  // Silence everything when leaving the page.
  useEffect(() => () => { run.current++; window.clearTimeout(endTimer.current); engine?.stop() }, [engine])

  const ready = !!engine && !!results && results.length === frames.length

  /** One step per date from `from` to `to`: its category, where the region sits (stereo pan) and the chord, slide and bell. */
  const stepsFor = useCallback((from: number, to: number, stepMs: number): SequenceStep[] => {
    if (!results) return []
    return sequenceSteps(results, region, mapping, from, Math.min(to, frames.length - 1), stepMs)
  }, [results, frames, region, mapping])

  /** The last date of the part being played, or null when the run goes to the end. Kept so a change of speed does not run past it. */
  const rangeEnd = useRef<number | null>(null)

  /** Plays dates from `from` to `to` (the end, unless a story chapter says otherwise). Needs a click or key press, which is where every caller comes from. */
  const startFrom = useCallback(async (from: number, speedNow: Speed, to: number = frames.length - 1) => {
    if (!engine || !results) return
    cancelRun()
    const mine = run.current
    await engine.unlock()
    if (mine !== run.current) return
    engine.setVolume(volumeRef.current)
    engine.stop()
    const stepMs = STEP_MS[speedNow]
    const last = Math.min(frames.length - 1, Math.max(from, to))
    rangeEnd.current = last === frames.length - 1 ? null : last
    const steps = stepsFor(from, last, stepMs)
    setFinished(false)
    setStatus('playing')
    engine.playSequence(steps, k => {
      if (mine !== run.current) return
      setIndex(from + k)
      speakStep(from + k)
      onDateRef.current?.(from + k, results[from + k].category)
      if (k === steps.length - 1) {
        endTimer.current = window.setTimeout(() => {
          if (mine !== run.current) return
          setStatus('idle')
          // "That is the last date" is only true when the run reached the end of the data.
          setFinished(last === frames.length - 1)
          speakStop('finished', last)
          lastCategory.current = null
        }, stepMs)
      }
    })
  }, [engine, results, frames, stepsFor, speakStep, speakStop, cancelRun])

  /** Sounds one date on its own and leaves the player stopped there. */
  const playOne = useCallback(async (i: number) => {
    if (!engine || !results) return
    cancelRun()
    const mine = run.current
    await engine.unlock()
    if (mine !== run.current) return
    engine.setVolume(volumeRef.current)
    engine.stop()
    setStatus('idle')
    setIndex(i)
    speakNow(i)
    onDateRef.current?.(i, results[i].category)
    // Alone, a date has no earlier note to slide from or to jump from, so it gets the chord only.
    const { pad } = voicingFor(results, i, mapping)
    engine.playSequence([{ category: results[i].category, atMs: 0, pan: panFor(region), elevation: elevationFor(region), ...(pad && { pad }) }], () => {})
  }, [engine, results, region, mapping, speakNow, cancelRun])

  const play = useCallback(() => {
    if (!ready) return
    if (status === 'paused') {
      setStatus('playing')
      engine.resume()
    } else if (status === 'idle') {
      lastCategory.current = null
      void startFrom(index >= frames.length - 1 ? 0 : index, speed)
    }
  }, [ready, status, engine, startFrom, index, frames.length, speed])

  const pause = useCallback(() => {
    if (status !== 'playing') return
    engine?.pause()
    setStatus('paused')
    speakStop('paused', index)
  }, [status, engine, speakStop, index])

  const stop = useCallback(() => {
    cancelRun()
    engine?.stop()
    setStatus('idle')
    speakStop('stopped', index)
    setIndex(0)
    lastCategory.current = null
  }, [engine, cancelRun, speakStop, index])

  const replay = useCallback(() => {
    if (ready) void playOne(index)
  }, [ready, playOne, index])

  /** Jump to a date: while playing the sequence carries on from there; otherwise that date plays on its own. */
  const goTo = useCallback((i: number) => {
    if (!ready) return
    const clamped = Math.min(frames.length - 1, Math.max(0, i))
    if (status === 'playing') {
      setIndex(clamped)
      speakNow(clamped)
      void startFrom(clamped, speed)
    } else {
      void playOne(clamped)
    }
  }, [ready, frames.length, status, speed, startFrom, playOne, speakNow])

  /** Stops the sound and any run but stays on the same date, for the sound-map explorer to take over. */
  const halt = useCallback(() => {
    cancelRun()
    engine?.stop()
    setStatus('idle')
  }, [engine, cancelRun])

  /** Saves the whole soundscape at the current speed as a WAV file. */
  const download = useCallback(async () => {
    if (!engine || !results) return
    setDownloading(true)
    setDownloadError('')
    try {
      const blob = await engine.renderToWav(stepsFor(0, frames.length - 1, STEP_MS[speed]))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `earth-jukebox-${visualization.id}-${region.id}.wav`
      document.body.append(link)
      link.click()
      link.remove()
      // Some browsers cancel the save if the address goes away at once.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error))
    } finally {
      setDownloading(false)
    }
  }, [engine, results, stepsFor, frames.length, speed, visualization.id, region.id])

  const setSpeed = useCallback((next: Speed) => {
    setSpeedState(next)
    if (status === 'playing') void startFrom(index, next, rangeEnd.current ?? undefined)
  }, [status, index, startFrom])

  /** Plays only dates `from` to `to`, with the same sound, announcements and picture as a full run, and stops at `to`. */
  const playRange = useCallback((from: number, to: number) => {
    if (!ready) return
    lastCategory.current = null
    void startFrom(from, speed, to)
  }, [ready, startFrom, speed])

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
    engine, region, results, index, status, speed, volume, finished, ready, style, setStyle, spatial, setSpatial, downloading, downloadError,
    error: engineError || analysisError,
    loading: !engineError && !analysisError && !results,
    play, pause, stop, replay, goTo, halt, playRange, download, setSpeed, setVolume,
    describeDate, formatDate,
    categoryAt: (i: number) => results?.[i]?.category ?? null,
  }
}
