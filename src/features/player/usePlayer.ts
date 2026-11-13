// The player's state and its link to the sound engine. Keeping the image, the slider and the sound on the same
// date is the whole job: every change of date goes through here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzeChange, type Contour, type FrameAnalysis, type Score } from '../../analysis'
import { hasChange } from '../../analysis/available'
import { useFrameAnalysis } from '../../analysis/useFrameAnalysis'
import type { SequenceStep } from '../../audio'
import { coarseCategory, hiddenChanges } from '../../audio/coarse'
import { elevationFor, panFor, useSpatialMode } from '../../audio/pan'
import { styleFor, useSoundStyle, type SoundStyle } from '../../audio/style'
import { useSoundEngine } from '../../audio/useSoundEngine'
import { voicingFor } from '../../audio/voicing'
import { useAnnounce } from '../../components/useAnnounce'
import { primaryRegion, variableWords, type Region, type SoundMapping, type Visualization } from '../../data'
import { dateFormatterFor } from '../../dates'
import { categoryChanged, describeContour, describeHidden, playerDateLine, playerStopLine, withUnit, type DateParts, type StopKind } from '../../describe'
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
export function usePlayer(
  visualization: Visualization,
  onDate?: (index: number, category: string | null) => void,
  /** F40: where a link opened the page. Both are already checked against this data set; null means "as usual". */
  start?: { index: number | null; style: SoundStyle | null },
  /** F48: the region the listener chose. Without it, the primary region. */
  options: { region?: Region } = {},
) {
  const { frames, mapping } = visualization
  const region = options.region ?? primaryRegion(visualization)
  const announce = useAnnounce()
  const [detail] = useDescriptionDetail()
  const formatDate = useMemo(() => dateFormatterFor(frames.map(frame => frame.date)), [frames])

  const [index, setIndex] = useState(start?.index ?? 0)
  const [status, setStatus] = useState<Status>('idle')
  const [speed, setSpeedState] = useState<Speed>('normal')
  const [volume, setVolumeState] = useState(() => welcomeVolume() ?? 0.8)
  const [finished, setFinished] = useState(false)
  const [savedStyle, saveStyle] = useSoundStyle()
  // A style from a link holds for this visit only. It is never saved, so a shared link cannot change what the listener chose, and choosing a style drops it.
  const [linkedStyle, applyLinkedStyle] = useState<SoundStyle | null>(start?.style ?? null)
  const setStyle = useCallback((next: SoundStyle) => { applyLinkedStyle(null); saveStyle(next) }, [saveStyle])
  // A remembered "change" is not used for a data set with no baseline: it plays as "full", exactly as before.
  const changeAvailable = hasChange(visualization)
  const style = styleFor(linkedStyle ?? savedStyle, changeAvailable)
  const changeOn = style === 'change'
  const [spatial, setSpatial] = useSpatialMode()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  /** True while "Trace the warm edge" is playing its lines. */
  const [tracing, setTracing] = useState(false)

  const { engine, engineError } = useSoundEngine(mapping)

  // The sound style (full, simple or change) is set on the engine whenever it or the style changes.
  useEffect(() => { engine?.setStyle(style) }, [engine, style])
  // Likewise stereo or 3D sound.
  useEffect(() => { engine?.setSpatial(spatial) }, [engine, spatial])

  // Analyze every frame once, when the page opens. The page remounts for another visualization, so nothing is stale.
  const { results, error: analysisError } = useFrameAnalysis(visualization, region, { withChange: changeAvailable })

  // The change score of the date on screen (change style only): its contours decide whether "Trace the warm edge" can be used.
  const [scored, setScore] = useState<Score | null>(null)
  /** Why this date has no score, in words. Empty when it has one, or has not been asked for yet. */
  const [scoreError, setScoreError] = useState<{ frameId: string; reason: string } | null>(null)
  // A score for another date, or one kept from before the style changed, is not this date's.
  const score = changeOn && scored?.frameId === frames[index].id ? scored : null
  const scoreProblem = changeOn && !score && scoreError?.frameId === frames[index].id ? scoreError.reason : ''
  useEffect(() => {
    if (!changeOn) return
    let cancelled = false
    analyzeChange(frames[index], visualization)
      .then(done => { if (!cancelled) { setScoreError(null); setScore(done) } })
      .catch((error: unknown) => {
        // No score for this date: the trace button stays disabled, and the page says why.
        if (cancelled) return
        const reason = error instanceof Error ? error.message : String(error)
        setScoreError({ frameId: frames[index].id, reason })
        announce(`The change for this date could not be read. ${reason}`)
      })
    return () => { cancelled = true }
  }, [changeOn, frames, index, visualization, announce])

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
    const { changeStep, medianChange } = changeOn ? results[i] : { changeStep: undefined, medianChange: undefined }
    engine.playSequence([{
      category: results[i].category, atMs: 0, pan: panFor(region), elevation: elevationFor(region), ...(pad && { pad }),
      ...(changeStep && { changeStep, ...(medianChange !== undefined && { medianChange }) }),
    }], () => {})
  }, [engine, results, region, mapping, speakNow, cancelRun, changeOn])

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
        announce(describeContour(visualization, line, { detail }))
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
    engine, region, results, index, status, speed, volume, finished, ready, style, setStyle, applyLinkedStyle, changeAvailable, score, scoreProblem, tracing, traceWarmEdge, stopTrace, spatial, setSpatial, downloading, downloadError,
    error: engineError || analysisError,
    loading: !engineError && !analysisError && !results,
    play, pause, stop, replay, goTo, showDate, halt, playRange, download, setSpeed, setVolume, testSound, hearLegend, hearBothWays, hearWhatIsHidden,
    describeDate, formatDate,
    categoryAt: (i: number) => results?.[i]?.category ?? null,
  }
}
