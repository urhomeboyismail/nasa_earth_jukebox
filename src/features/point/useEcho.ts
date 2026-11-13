// Echo points (ticket IX09). E points at the next place in the offline order: the date's hot spots by size, largest first, then the centre, and round
// again. The voice guide points with the same `point` action, naming a hot spot's id or a compass place. Either way the cursor moves there in silence, the
// beacon plays three notes from that place, and a short line says where it is. The line is announced for E; for a voice point the guide says it instead.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractFeatures, type FrameFeatures, type Hotspot } from '../../analysis/features'
import { baseInput, baselineFor, defaultLoadPixels } from '../../analysis/video/input'
import type { Ensemble } from '../../audio/ensemble/types'
import { useAnnounce } from '../../components'
import type { Frame, Visualization } from '../../data'
import { noteForPosition, positionOfValue } from '../../interaction/notes'
import { useActionHandler } from '../../interaction/registry'
import { presetFor } from '../../sonify'
import { sectorOf } from '../../sonify/captions'
import type { ExplorerState } from '../explore/useExplorer'
import { playBeacon } from './beacon'
import { isCompassPlace, nextOffline, offlineOrder, pointText, resolveTarget, type Resolved } from './targets'

export const OFF_TEXT = 'Turn on the sound map to hear where that is.'
export const LOCKED_TEXT = 'Locked on this place. Press L to unlock before pointing.'
export const FAILED_TEXT = 'The hot spots could not be read.'

/** What Echo needs of the sound map. */
export type EchoExplorer = Pick<ExplorerState, 'on' | 'grid' | 'area' | 'locked' | 'moveTo'> & {
  ensemble: Pick<Ensemble, 'playNotes' | 'status' | 'start'>
}

type Read = (visualization: Visualization, frame: Frame) => Promise<Pick<FrameFeatures, 'hotspots'>>

type Options = {
  visualization: Visualization
  /** The date on screen: its hot spots are the targets. */
  frame: Frame
  explorer: EchoExplorer
  /** How a frame is read. For tests; the app's reader by default. */
  read?: Read
}

/** One frame's features, read on its own, as the find game reads them (IX04). */
const readFrame: Read = async (visualization, frame) => {
  const [pixels, baseline] = await Promise.all([defaultLoadPixels(frame.image), baselineFor(visualization, frame.date, defaultLoadPixels)])
  return extractFeatures(pixels, { ...baseInput(visualization, frame.id, frame.date, 1), baseline })
}

export type Echo = ReturnType<typeof useEcho>

export function useEcho({ visualization, frame, explorer, read = readFrame }: Options) {
  const announce = useAnnounce()
  const preset = useMemo(() => presetFor(visualization.sonification?.preset ?? 'major'), [visualization])

  /** The visible line. Cleared when the sound map goes off or the data set changes (set during render, React's way of resetting state on a prop). */
  const [text, setText] = useState('')
  const [shownFor, setShownFor] = useState({ on: explorer.on, visualization })
  if (shownFor.on !== explorer.on || shownFor.visualization !== visualization) {
    setShownFor({ on: explorer.on, visualization })
    setText('')
  }

  /** The date's hot spots, read once per date. Kept in state too, so the screen can tell the voice guide which ids it may point at. */
  const reads = useRef<{ of: Frame; hotspots: Promise<readonly Hotspot[]> } | null>(null)
  const [spots, setSpots] = useState<{ of: Frame; hotspots: readonly Hotspot[] } | null>(null)
  /** The last place E pointed at, on which date. */
  const last = useRef<{ of: Frame; target: string } | null>(null)
  /** Stops the pings still to come. */
  const stopPings = useRef<() => void>(() => {})
  /** Moves on with every point, so a slow read cannot point after a newer press. */
  const attempt = useRef(0)
  const latest = useRef({ explorer, frame })
  useEffect(() => { latest.current = { explorer, frame } })

  const hotspotsOf = useCallback((of: Frame) => {
    if (reads.current?.of !== of) {
      const hotspots = read(visualization, of).then(features => features.hotspots)
      reads.current = { of, hotspots }
      hotspots.then(found => setSpots({ of, hotspots: found }), () => { if (reads.current?.of === of) reads.current = null })
    }
    return reads.current.hotspots
  }, [read, visualization])

  // Read the date's hot spots while the sound map is on, so E answers at once.
  useEffect(() => {
    if (explorer.on) hotspotsOf(frame).catch(() => {})
  }, [explorer.on, frame, hotspotsOf])

  /** The note of the place: a spot's strongest value, or the value in the cell for a compass place (the middle of the legend when it cannot be read). */
  const midiOf = useCallback((resolved: Resolved): number => {
    if (resolved.spot) return noteForPosition(resolved.spot.peakPosition, preset)
    const { grid } = latest.current.explorer
    const value = grid?.cells[resolved.cell.row * grid.cols + resolved.cell.col]?.value ?? null
    return noteForPosition(value === null ? 0.5 : positionOfValue(value, visualization.colorScale), preset)
  }, [preset, visualization])

  /** Points at `target` (or the next place in the offline order) among `hotspots`. A target that names nothing on this date does nothing. */
  const pointAmong = useCallback((hotspots: readonly Hotspot[], target: string | undefined, of: Frame) => {
    const { explorer: map } = latest.current
    if (!map.on || !map.grid || map.locked || latest.current.frame !== of) return
    const previous = last.current?.of === of ? last.current.target : null
    const name = target ?? nextOffline(offlineOrder(hotspots), previous)
    const resolved = resolveTarget(name, hotspots, map.area, map.grid.cols, map.grid.rows)
    if (!resolved) return
    if (target === undefined) last.current = { of, target: name }
    stopPings.current()
    map.moveTo(resolved.cell.col, resolved.cell.row, 'follow')
    stopPings.current = playBeacon(map.ensemble, { midi: midiOf(resolved), x: resolved.x, y: resolved.y })
    const line = pointText(resolved, name, hotspots, visualization)
    setText(line)
    if (target === undefined) announce(line)
  }, [midiOf, visualization, announce])

  const say = useCallback((line: string) => { setText(line); announce(line) }, [announce])

  useActionHandler('point', action => {
    const { target } = action
    if (!explorer.on || !explorer.grid) { if (target !== undefined) say(OFF_TEXT); return }
    if (explorer.locked) { say(LOCKED_TEXT); return }
    // The press (or the guide the listener spoke to) starts the audio (WCAG 1.4.2): the beacon goes through the map's ensemble.
    if (explorer.ensemble.status() !== 'on') explorer.ensemble.start().catch(() => {})
    const mine = ++attempt.current
    // A compass place needs no reading: it sounds at once.
    if (target !== undefined && isCompassPlace(target)) { pointAmong([], target, frame); return }
    hotspotsOf(frame).then(
      hotspots => { if (mine === attempt.current) pointAmong(hotspots, target, frame) },
      () => { if (mine === attempt.current && target === undefined) say(FAILED_TEXT) },
    )
  })

  // Escape stops the pings still to come, with the rest of the sound.
  useActionHandler('stopSpeech', () => stopPings.current())

  // The sound map going off, a new data set, or leaving the page stops the pings.
  const on = explorer.on
  useEffect(() => {
    if (!on) stopPings.current()
    return () => stopPings.current()
  }, [on, visualization])

  return {
    /** The line, shown only while the sound map is on. */
    text: explorer.on ? text : '',
    /** The date's hot spots as the guide may name them, largest first: their ids and compass names. Empty until the date has been read. */
    hotspots: spots?.of === frame ? spots.hotspots.map(spot => ({ id: spot.id, place: sectorOf(spot.centroid.x, spot.centroid.y) })) : [],
  }
}
