// The find game (ticket IX04): find the highest place, the edge or the largest hot spot by ear. A soft pulse at the cursor gets faster as it nears the
// target; finding it plays a short success figure and the score is announced once. The best score of each data set and level is kept on this device.
// F, the button or gamepad Menu start and stop it; Escape and the sound map going off stop it.
//
// A move is any change of the cursor (keys, touch, mouse, gamepad and the sound map's sliders alike), seen while rendering. The clock is read only in
// effects and timers, which keep the times in refs; the state changes only in the press, in render (following the cursor) and in timer callbacks.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractFeatures, type FrameFeatures } from '../../analysis/features'
import { baseInput, baselineFor, defaultLoadPixels } from '../../analysis/video/input'
import { INTERACTIVE_LOOKAHEAD_S } from '../../audio/ensemble/constants'
import type { Ensemble } from '../../audio/ensemble/types'
import { panForPoint } from '../../audio/pan'
import { useAnnounce } from '../../components'
import { variableWords, type Frame, type Visualization } from '../../data'
import { markNote, noteForPosition, positionOfValue } from '../../interaction/notes'
import { useActionHandler } from '../../interaction/registry'
import { presetFor } from '../../sonify'
import type { ExplorerState } from '../explore/useExplorer'
import { PULSE_LEVEL, PULSE_SECONDS, pulseIntervalMs } from './pulse'
import { clock, targetScore } from './score'
import { bestKey, readFindRecord, saveResult, type Best } from './store'
import { FOUND_WITHIN, distanceTo, levelTargets, targetsFor, type Level, type Target, type TargetKind } from './targets'

/** The next target starts this long after one is found. */
export const NEXT_TARGET_MS = 800
const SUCCESS_SECONDS = 0.3
const SUCCESS_LEVEL = 0.5

/** What the game needs of the sound map. */
export type FindExplorer = Pick<ExplorerState, 'on' | 'grid' | 'cursor' | 'area'> & {
  ensemble: Pick<Ensemble, 'playNotes' | 'playDropout' | 'now' | 'status' | 'start'>
}

export type Found = { score: number; moves: number; seconds: number }
export type Playing = {
  status: 'seeking' | 'found'
  level: Level
  targets: Target[]
  /** Which target is asked for. */
  at: number
  /** Moves since this target was asked for. */
  moves: number
  /** Points so far, and how the last target went (shown with the next one). */
  total: number
  last: Found | null
}
export type Game =
  | { status: 'idle' }
  | { status: 'loading' | 'none' | 'failed'; level: Level }
  | Playing
  | { status: 'done'; level: Level; total: number; seconds: number; best: Best; last: Found | null }

const IDLE: Game = { status: 'idle' }

/** The game after the cursor moved to `cursor`: one more move, and found when it is within FOUND_WITHIN of the target. Pure. */
export function afterMove(game: Playing, cursor: { col: number; row: number }): Playing {
  if (game.status !== 'seeking') return game
  const moves = game.moves + 1
  return { ...game, moves, status: distanceTo(cursor, game.targets[game.at]) <= FOUND_WITHIN ? 'found' : 'seeking' }
}

const readBest = (dataId: string, level: Level): Best | null => readFindRecord().best[bestKey(dataId, level)] ?? null

/** One frame's features, read on its own (its targets need no other date). */
const readFrame = async (visualization: Visualization, frame: Frame): Promise<FrameFeatures> => {
  const [pixels, baseline] = await Promise.all([defaultLoadPixels(frame.image), baselineFor(visualization, frame.date, defaultLoadPixels)])
  return extractFeatures(pixels, { ...baseInput(visualization, frame.id, frame.date, 1), baseline })
}

type Options = {
  visualization: Visualization
  /** The date on screen: its targets are asked for. */
  frame: Frame
  explorer: FindExplorer
  /** How a frame is read. For tests; the app's reader by default. */
  read?: (visualization: Visualization, frame: Frame) => Promise<Pick<FrameFeatures, 'grid' | 'edges' | 'hotspots'>>
}

export type FindGame = ReturnType<typeof useFindGame>

export function useFindGame({ visualization, frame, explorer, read = readFrame }: Options) {
  const announce = useAnnounce()
  const preset = useMemo(() => presetFor(visualization.sonification?.preset ?? 'major'), [visualization])
  const words = variableWords(visualization.variable)
  const nameOf = useCallback(
    (kind: TargetKind) => (kind === 'highest' ? `the ${words.highest} place` : kind === 'edge' ? `the ${words.edge}` : 'the largest hot spot'),
    [words.highest, words.edge],
  )

  const [game, setGame] = useState<Game>(IDLE)
  const [level, setLevelState] = useState<Level>(1)
  /** Seconds since the game's first move, moved on once a second for the clock on screen. */
  const [elapsed, setElapsed] = useState(0)

  // Following the props while rendering (React's way): the cursor moved, the sound map went off, the data set changed.
  const [seen, setSeen] = useState(explorer.cursor)
  if (seen !== explorer.cursor) {
    setSeen(explorer.cursor)
    if (game.status === 'seeking') setGame(afterMove(game, explorer.cursor))
  }
  if (!explorer.on && game.status !== 'idle') setGame(IDLE)
  const [best, setBest] = useState<Best | null>(() => readBest(visualization.id, 1))
  const [bestFor, setBestFor] = useState(visualization.id)
  if (bestFor !== visualization.id) {
    setBestFor(visualization.id)
    setBest(readBest(visualization.id, level))
  }

  /** Moves on when a game starts or stops, so a slow read or a late timer cannot act on a game that was stopped. */
  const token = useRef(0)
  /** When the game's first move came, and when this target's time started (its first move, or when it was asked for). */
  const times = useRef<{ game: number | null; target: number | null }>({ game: null, target: null })
  /** The wait before the next target. Cleared by stop and unmount only, so a re-render cannot drop it. */
  const nextTimer = useRef<number | undefined>(undefined)
  const latest = useRef({ explorer, game, visualization, frame, level })
  useEffect(() => { latest.current = { explorer, game, visualization, frame, level } })
  useEffect(() => () => window.clearTimeout(nextTimer.current), [])

  const stop = useCallback(() => {
    token.current++
    window.clearTimeout(nextTimer.current)
    setGame(IDLE)
  }, [])

  const start = useCallback((chosen: Level) => {
    const map = latest.current.explorer
    const grid = map.grid
    if (!map.on || !grid) return
    // The press starts the audio (WCAG 1.4.2).
    if (map.ensemble.status() !== 'on') map.ensemble.start().catch(() => {})
    window.clearTimeout(nextTimer.current)
    const mine = ++token.current
    times.current = { game: null, target: null }
    setElapsed(0)
    setGame({ status: 'loading', level: chosen })
    read(latest.current.visualization, latest.current.frame).then(features => {
      if (mine !== token.current || !latest.current.explorer.on) return
      const targets = levelTargets(targetsFor(features, grid.cols, grid.rows, map.area), chosen)
      setGame(targets.length === 0 ? { status: 'none', level: chosen } : { status: 'seeking', level: chosen, targets, at: 0, moves: 0, total: 0, last: null })
    }, () => {
      if (mine === token.current) setGame({ status: 'failed', level: chosen })
    })
  }, [read])

  const playing = game.status === 'loading' || game.status === 'seeking' || game.status === 'found'
  const toggle = useCallback(() => {
    const status = latest.current.game.status
    if (status === 'loading' || status === 'seeking' || status === 'found') stop()
    else start(latest.current.level)
  }, [start, stop])

  useActionHandler('find', action => {
    if (!explorer.on || !explorer.grid) return
    if (action.command === 'stop') stop()
    else if (action.command === 'start') start(level)
    else toggle()
  })
  useActionHandler('stopSpeech', () => { if (latest.current.game.status !== 'idle') stop() })

  // The first move starts the clocks.
  const moves = game.status === 'seeking' || game.status === 'found' ? game.moves : 0
  useEffect(() => {
    if (moves === 0) return
    const now = Date.now()
    times.current.game ??= now
    times.current.target ??= now
  }, [moves])

  // The clock on screen, once a second while a target is asked for.
  const ticking = game.status === 'seeking' && moves > 0
  useEffect(() => {
    if (!ticking) return
    const timer = window.setInterval(() => setElapsed((Date.now() - (times.current.game ?? Date.now())) / 1000), 1000)
    return () => window.clearInterval(timer)
  }, [ticking])

  // The pulse: a soft note at the cursor, sooner the closer it is to the target. Only while a target is asked for.
  const seekingTarget = game.status === 'seeking' ? game.at : null
  useEffect(() => {
    if (seekingTarget === null) return
    let timer: number | undefined
    const pulse = () => {
      const { explorer: map, game: now } = latest.current
      if (now.status !== 'seeking' || !map.grid) return
      const { cursor, grid, area } = map
      const cell = grid.cells[cursor.row * grid.cols + cursor.col]
      if (!cell || cell.value === null || cell.category === 'insufficient') map.ensemble.playDropout()
      else {
        map.ensemble.playNotes([{
          midi: noteForPosition(positionOfValue(cell.value, latest.current.visualization.colorScale), preset),
          level: PULSE_LEVEL,
          seconds: PULSE_SECONDS,
          pan: panForPoint(area.x0 + ((cursor.col + 0.5) / grid.cols) * (area.x1 - area.x0)),
        }])
      }
      timer = window.setTimeout(pulse, pulseIntervalMs(distanceTo(cursor, now.targets[now.at])))
    }
    pulse()
    return () => window.clearTimeout(timer)
  }, [seekingTarget, preset])

  // A target found: the score from the clocks, the success figure and the score line once; then, after a moment, the next target or the end.
  const foundAt = game.status === 'found' ? game.at : null
  useEffect(() => {
    const current = latest.current.game
    if (foundAt === null || current.status !== 'found') return
    const now = Date.now()
    const seconds = (now - (times.current.target ?? now)) / 1000
    const score = targetScore(current.moves, seconds)
    const last: Found = { score, moves: current.moves, seconds }
    const total = current.total + score
    const target = current.targets[current.at]
    const { ensemble } = latest.current.explorer
    ensemble.playNotes([{ midi: noteForPosition(target.position, preset), level: SUCCESS_LEVEL, seconds: SUCCESS_SECONDS, pan: 0 }])
    ensemble.playNotes([{ midi: markNote(preset), level: SUCCESS_LEVEL, seconds: SUCCESS_SECONDS, pan: 0 }], ensemble.now() + INTERACTIVE_LOOKAHEAD_S + SUCCESS_SECONDS)
    const shown = Math.round(seconds)
    announce(`Found ${nameOf(target.kind)} in ${last.moves} ${last.moves === 1 ? 'move' : 'moves'} and ${shown} ${shown === 1 ? 'second' : 'seconds'}: ${score} points.`)
    const mine = token.current
    window.clearTimeout(nextTimer.current)
    nextTimer.current = window.setTimeout(() => {
      if (mine !== token.current) return
      if (current.at + 1 < current.targets.length) {
        times.current.target = Date.now()
        setGame({ ...current, status: 'seeking', at: current.at + 1, moves: 0, total, last })
        return
      }
      const gameSeconds = (now - (times.current.game ?? now)) / 1000
      const kept = saveResult(bestKey(latest.current.visualization.id, current.level), { score: total, seconds: Math.round(gameSeconds * 10) / 10 })
      setBest(kept)
      setGame({ status: 'done', level: current.level, total, seconds: gameSeconds, best: kept, last })
    }, NEXT_TARGET_MS)
  }, [foundAt, preset, nameOf, announce])

  const setLevel = (next: Level) => {
    setLevelState(next)
    setBest(readBest(visualization.id, next))
  }

  /** The visible line: the target and the clock, or what just happened. */
  let line = ''
  if (game.status === 'loading') line = 'Reading the map for the game…'
  else if (game.status === 'none') line = 'This map has nothing to find. Try another date.'
  else if (game.status === 'failed') line = 'The map could not be read for the game.'
  else if (game.status === 'found') line = `Found ${nameOf(game.targets[game.at].kind)}.`
  else if (game.status === 'seeking') {
    const before = game.last ? `Last target: ${game.last.score} points. ` : ''
    line = `${before}Find ${nameOf(game.targets[game.at].kind)}. Target ${game.at + 1} of ${game.targets.length}. Time ${clock(elapsed)}.`
  } else if (game.status === 'done') line = `Game over: ${game.total} points in ${clock(game.seconds)}.`

  return {
    game, line, level, setLevel, best, playing,
    start: () => start(level), stop,
    /** Shown only while the sound map is on and read. */
    shown: explorer.on && explorer.grid !== null,
  }
}
