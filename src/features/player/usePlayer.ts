// The player's state and its link to the sound engine. Keeping the image, the slider and the sound on the same
// date is the whole job: every change of date goes through here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzeAll, analyzeChange, type ChangeVisualization, type Contour, type FrameAnalysis, type Score } from '../../analysis'
import { hasChange } from '../../analysis/available'
import { createSoundEngine, type SequenceStep, type SoundEngine } from '../../audio'
import { coarseCategory, hiddenChanges } from '../../audio/coarse'
import { elevationFor, panFor, useSpatialMode } from '../../audio/pan'
import { styleFor, useSoundStyle } from '../../audio/style'
import { voicingFor } from '../../audio/voicing'
import { useAnnounce } from '../../components/useAnnounce'
import { variableWords, type Region, type SoundMapping, type Visualization } from '../../data'
import { dateFormatterFor } from '../../dates'
import { describeContour, describeHidden } from '../../describe'
import { useDescriptionDetail } from '../../describe/detail'
import { legendLabel, legendSteps, LEGEND_GAP_MS } from '../learn/legendTour'
import { welcomeVolume } from '../welcome/storage'
import { onPlayerCommand } from './controls'

export type Speed = 'slow' | 'normal' | 'fast'
export type Status = 'idle' | 'playing' | 'paused'

/** Silence between one traced line and the next. */
const TRACE_GAP_MS = 600

/** Length of each of the two sounds in "Hear this date both ways". */
const BOTH_WAYS_MS = 2000
/** F33: the time between the two dates of a pair, and the pause between the coarse pair and the strict pair. */
const HIDDEN_STEP_MS = 800
const HIDDEN_GAP_MS = 1600

/** Time between dates. */
export const STEP_MS: Record<Speed, number> = { slow: 1600, normal: 1000, fast: 500 }

/** One step per date from `from` to `to`: its category, where the region sits (stereo pan and height) and the chord, slide and bell. Pure, so the sound regression test plays exactly what Listen plays. */
export function sequenceSteps(
  results: FrameAnalysis[], region: Pick<Region, 'points'>, mapping: SoundMapping, from: number, to: number, stepMs: number, withChange = false,
): SequenceStep[] {
  const pan = panFor(region)
  const elevation = elevationFor(region)
  return results.slice(from, to + 1).map((result, k) => ({
    category: result.category, atMs: k * stepMs, pan, elevation, ...voicingFor(results, from + k, mapping),
    // The change style plays the change from normal; the others never carry it, so they sound as they always did.
    ...(withChange && result.changeStep && { changeStep: result.changeStep, ...(result.medianChange !== undefined && { medianChange: result.medianChange }) }),
  }))
}

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
  const [volume, setVolumeState] = useState(() => welcomeVolume() ?? 0.8)
  const [finished, setFinished] = useState(false)
  const [chosenStyle, setStyle] = useSoundStyle()
  // A remembered "change" is not used for a data set with no baseline: it plays as "full", exactly as before.
  const changeAvailable = hasChange(visualization)
  const style = styleFor(chosenStyle, changeAvailable)
  const changeOn = style === 'change'
  const [spatial, setSpatial] = useSpatialMode()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  /** True while "Trace the warm edge" is playing its lines. */
  const [tracing, setTracing] = useState(false)

  const { engine, engineError } = useMemo((): { engine: SoundEngine | null; engineError: string } => {
    try {
      return { engine: createSoundEngine(mapping), engineError: '' }
    } catch (error) {
      return { engine: null, engineError: error instanceof Error ? error.message : String(error) }
    }
  }, [mapping])

  // The sound style (full, simple or change) is set on the engine whenever it or the style changes.
  useEffect(() => { engine?.setStyle(style) }, [engine, style])
  // Likewise stereo or 3D sound.
  useEffect(() => { engine?.setSpatial(spatial) }, [engine, spatial])

  // Analyze every frame once, when the page opens. The page remounts for another visualization, so nothing is stale.
  useEffect(() => {
    let cancelled = false
    // With a baseline each result also carries its change step. Without one the call is exactly what it was.
    const done = changeAvailable ? analyzeAll(frames, region, colorScale, mapping, visualization as ChangeVisualization) : analyzeAll(frames, region, colorScale, mapping)
    done
      .then(all => { if (!cancelled) setResults(all) })
      .catch((error: unknown) => { if (!cancelled) setAnalysisError(error instanceof Error ? error.message : String(error)) })
    return () => { cancelled = true }
  }, [frames, region, colorScale, mapping, visualization, changeAvailable])

  // The change score of the date on screen (change style only): its contours decide whether "Trace the warm edge" can be used.
  const [scored, setScore] = useState<Score | null>(null)
  // A score for another date, or one kept from before the style changed, is not this date's.
  const score = changeOn && scored?.frameId === frames[index].id ? scored : null
  const [detail] = useDescriptionDetail()
  useEffect(() => {
    if (!changeOn) return
    let cancelled = false
    analyzeChange(frames[index], visualization as ChangeVisualization)
      .then(done => { if (!cancelled) setScore(done) })
      .catch(() => { /* No score for this date: the trace button stays disabled. */ })
    return () => { cancelled = true }
  }, [changeOn, frames, index, visualization])

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
    return category === 'insufficient' ? 'not enough data' : (mapping.categories.find(c => c.id === category)?.label ?? category).toLowerCase()
  }, [results, mapping])

  /** "March 2024: warm" (the date as detailed as the dataset needs). Said once per date unless `force` is set (Replay says it again on purpose). */
  const describeDate = useCallback((i: number) => `${formatDate(frames[i].date)}: ${labelFor(i)}`, [frames, formatDate, labelFor])
  const speak = useCallback((i: number, force = false) => {
    if (!force && lastSpoken.current === i) return
    lastSpoken.current = i
    announce(describeDate(i))
  }, [announce, describeDate])

  /** Set while "Hear this date both ways" has put the engine on a style that is not the listener's own. */
  const borrowedStyle = useRef(false)
  const styleRef = useRef(style)
  useEffect(() => { styleRef.current = style })

  const cancelRun = useCallback(() => {
    run.current++
    window.clearTimeout(endTimer.current)
    setTracing(false)
    if (borrowedStyle.current) {
      borrowedStyle.current = false
      engine?.setStyle(styleRef.current)
    }
  }, [engine])

  // Silence everything when leaving the page.
  useEffect(() => () => { run.current++; window.clearTimeout(endTimer.current); engine?.stop() }, [engine])

  const ready = !!engine && !!results && results.length === frames.length

  /** One step per date from `from` to `to`: its category, where the region sits (stereo pan) and the chord, slide and bell. */
  const stepsFor = useCallback((from: number, to: number, stepMs: number): SequenceStep[] => {
    if (!results) return []
    return sequenceSteps(results, region, mapping, from, Math.min(to, frames.length - 1), stepMs, changeOn)
  }, [results, frames, region, mapping, changeOn])

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
      speak(from + k)
      onDateRef.current?.(from + k, results[from + k].category)
      if (k === steps.length - 1) {
        endTimer.current = window.setTimeout(() => {
          if (mine !== run.current) return
          setStatus('idle')
          // "That is the last date" is only true when the run reached the end of the data.
          setFinished(last === frames.length - 1)
        }, stepMs)
      }
    })
  }, [engine, results, frames, stepsFor, speak, cancelRun])

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
    // Alone, a date has no earlier note to slide from or to jump from, so it gets the chord only.
    const { pad } = voicingFor(results, i, mapping)
    const { changeStep, medianChange } = changeOn ? results[i] : ({} as Partial<FrameAnalysis>)
    engine.playSequence([{
      category: results[i].category, atMs: 0, pan: panFor(region), elevation: elevationFor(region), ...(pad && { pad }),
      ...(changeStep && { changeStep, ...(medianChange !== undefined && { medianChange }) }),
    }], () => {})
  }, [engine, results, region, mapping, speak, cancelRun, changeOn])

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

  /** Shows a date without sounding it, for the explorer when it plays a locked place across the dates. */
  const showDate = useCallback((i: number) => setIndex(Math.min(frames.length - 1, Math.max(0, i))), [frames.length])

  /** Stops the sound and any run but stays on the same date, for the sound-map explorer to take over. */
  const halt = useCallback(() => {
    cancelRun()
    engine?.stop()
    setStatus('idle')
  }, [engine, cancelRun])

  /**
   * "Trace the warm edge" (F18): each contour of the date on screen in turn, then `describeContour` for it. Needs the change style, a score
   * with at least one contour and a click or key press. Stop, Escape, a new date or leaving the page end it.
   */
  const traceWarmEdge = useCallback(async () => {
    if (!engine || !changeOn || !score) return
    if (!score.contours.length) { announce(`There is no ${variableWords(visualization.variable).edge} on this date.`); return }
    cancelRun()
    const mine = run.current
    await engine.unlock()
    if (mine !== run.current) return
    engine.setVolume(volumeRef.current)
    engine.stop()
    setStatus('idle')
    setTracing(true)
    const lines: Contour[] = score.contours
    const next = (k: number) => {
      if (mine !== run.current) return
      if (k >= lines.length) { setTracing(false); return }
      const line = lines[k]
      engine.traceContour(line, point => {
        if (mine !== run.current || point !== line.points.length - 1) return
        // The last point has sounded: say the line in words, then go on to the next one.
        announce(describeContour(visualization as ChangeVisualization, line, { detail }))
        endTimer.current = window.setTimeout(() => next(k + 1), TRACE_GAP_MS)
      })
    }
    next(0)
  }, [engine, changeOn, score, cancelRun, announce, visualization, detail])

  /** "Test sound" (F29): one plain note, so a listener can tell the sound is on before anything else plays. Needs a click or key press. */
  const testSound = useCallback(async () => {
    if (!engine) return
    cancelRun()
    const mine = run.current
    await engine.unlock()
    if (mine !== run.current) return
    engine.setVolume(volumeRef.current)
    engine.stop()
    setStatus('idle')
    const middle = mapping.categories[Math.floor(mapping.categories.length / 2)]
    engine.playSequence([{ category: middle.id, atMs: 0, pan: 0 }], () => {})
    announce('Test sound played.')
  }, [engine, mapping, cancelRun, announce])

  /**
   * "Hear the legend" (F39): one note per category, coolest to warmest, each label announced as it sounds. Plays in the full or simple sound
   * (the change style has no notes for categories, so it is borrowed away) and puts the listener's own style back at the end. Stop ends it.
   */
  const hearLegend = useCallback(async () => {
    if (!engine) return
    cancelRun()
    const mine = run.current
    await engine.unlock()
    if (mine !== run.current) return
    engine.setVolume(volumeRef.current)
    engine.stop()
    setStatus('idle')
    const steps = legendSteps(mapping)
    if (styleRef.current === 'change') { borrowedStyle.current = true; engine.setStyle('full') }
    engine.playSequence(steps, k => {
      if (mine !== run.current) return
      announce(legendLabel(mapping, k))
      if (k === steps.length - 1) {
        endTimer.current = window.setTimeout(() => {
          if (mine !== run.current) return
          cancelRun()
        }, LEGEND_GAP_MS)
      }
    }, { tick: false })
  }, [engine, mapping, cancelRun, announce])

  /** "Hear this date both ways" (F30): the date on screen in the full sound, then in the simple sound, so the two can be compared. */
  const hearBothWays = useCallback(async () => {
    if (!engine || !results) return
    cancelRun()
    const mine = run.current
    await engine.unlock()
    if (mine !== run.current) return
    engine.setVolume(volumeRef.current)
    engine.stop()
    setStatus('idle')
    const { pad } = voicingFor(results, index, mapping)
    const step = { category: results[index].category, atMs: 0, pan: panFor(region), elevation: elevationFor(region) }
    announce('Full sound, then simple sound.')
    borrowedStyle.current = true
    engine.setStyle('full')
    engine.playSequence([{ ...step, ...(pad && { pad }) }], () => {})
    endTimer.current = window.setTimeout(() => {
      if (mine !== run.current) return
      engine.stop()
      engine.setStyle('simple')
      engine.playSequence([step], () => {})
      endTimer.current = window.setTimeout(() => {
        // Put the listener's own choice of sound back.
        borrowedStyle.current = false
        engine.setStyle(styleRef.current)
      }, BOTH_WAYS_MS)
    }, BOTH_WAYS_MS)
  }, [engine, results, index, mapping, region, cancelRun, announce])

  /**
   * "What the sound hides" (F33): the first pair of neighbouring dates that differ by a step but share one note in a coarse sound, played coarse
   * (the same note twice) and then strict (two notes), both in the simple sound so only the notes differ.
   */
  const hearWhatIsHidden = useCallback(async () => {
    if (!engine || !results) return
    cancelRun()
    const mine = run.current
    await engine.unlock()
    if (mine !== run.current) return
    engine.setVolume(volumeRef.current)
    engine.stop()
    setStatus('idle')
    const { hidden, changes } = hiddenChanges(mapping.categories, results.map(result => result.category))
    announce(describeHidden(visualization, results, hidden, changes))
    if (hidden.length === 0) return
    const { from, to } = hidden[0]
    const at = (atMs: number, category: string) => ({ category, atMs, pan: panFor(region), elevation: elevationFor(region) })
    borrowedStyle.current = true
    engine.setStyle('simple')
    engine.playSequence([
      at(0, coarseCategory(mapping.categories, results[from].category)),
      at(HIDDEN_STEP_MS, coarseCategory(mapping.categories, results[to].category)),
    ], () => {})
    endTimer.current = window.setTimeout(() => {
      if (mine !== run.current) return
      engine.stop()
      engine.playSequence([at(0, results[from].category), at(HIDDEN_STEP_MS, results[to].category)], () => {})
      endTimer.current = window.setTimeout(() => {
        // Put the listener's own choice of sound back.
        borrowedStyle.current = false
        engine.setStyle(styleRef.current)
      }, HIDDEN_GAP_MS)
    }, HIDDEN_GAP_MS)
  }, [engine, results, mapping, visualization, region, cancelRun, announce])

  /** Ends a trace at once. */
  const stopTrace = useCallback(() => {
    if (!tracing) return
    cancelRun()
    engine?.stop()
    setTracing(false)
  }, [tracing, cancelRun, engine])

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
    if (ready) void startFrom(from, speed, to)
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
    engine, region, results, index, status, speed, volume, finished, ready, style, setStyle, changeAvailable, score, tracing, traceWarmEdge, stopTrace, spatial, setSpatial, downloading, downloadError,
    error: engineError || analysisError,
    loading: !engineError && !analysisError && !results,
    play, pause, stop, replay, goTo, showDate, halt, playRange, download, setSpeed, setVolume, testSound, hearLegend, hearBothWays, hearWhatIsHidden,
    describeDate, formatDate,
    categoryAt: (i: number) => results?.[i]?.category ?? null,
  }
}
