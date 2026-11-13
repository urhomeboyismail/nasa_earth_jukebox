// IX09 on real frames: the SN02 motion set (several hot spots) and the fixture. E points at the largest hot spot first, then the next, then the centre, and
// wraps; the voice guide's `point` action reaches the same beacon.
import { readFileSync } from 'node:fs'
import { act, render, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractFeatures, type FrameFeatures } from '../../analysis/features'
import { FEATURE_COLS, FEATURE_ROWS } from '../../analysis/features/types'
import { decodePng } from '../../analysis/png'
import { baseInput } from '../../analysis/video/input'
import { AnnouncerContext } from '../../components/announcerContext'
import type { Frame, Visualization } from '../../data'
import { visualizationSchema } from '../../data/schema'
import { keyInputOf } from '../../interaction/keys'
import { dispatch, resetActionHandlers } from '../../interaction/registry'
import { SHORTCUTS } from '../../interaction/shortcuts'
import { expectNoA11yViolations } from '../../test/a11y'
import { BEACON_GAP_MS, BEACON_PINGS } from './beacon'
import { offlineOrder, resolveTarget } from './targets'
import { LOCKED_TEXT, OFF_TEXT, useEcho, type EchoExplorer } from './useEcho'

const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const load = (dir: string) => visualizationSchema.parse(JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')))
const SETS = { motion: 'public/data/synthetic-motion', fixture: 'public/data/fixture' } as const

/** A frame's features straight from its PNG (no baseline: these sets have none). */
const readerFor = (dir: string) => async (visualization: Visualization, frame: Frame): Promise<FrameFeatures> =>
  extractFeatures(decodePng(readFileSync(`${dir}/${frame.image}`)), baseInput(visualization, frame.id, frame.date, 1))

const features: Record<keyof typeof SETS, FrameFeatures> = {} as Record<keyof typeof SETS, FrameFeatures>
beforeAll(async () => {
  for (const name of Object.keys(SETS) as (keyof typeof SETS)[]) {
    const visualization = load(SETS[name])
    features[name] = await readerFor(SETS[name])(visualization, visualization.frames[0])
  }
})

function rig(name: keyof typeof SETS, state = { on: true, locked: false }) {
  const visualization = load(SETS[name])
  const frame = visualization.frames[0]
  const ensemble = { playNotes: vi.fn(), status: vi.fn(() => 'on' as const), start: vi.fn(async () => {}) }
  const moves: { col: number; row: number; by: string | undefined }[] = []
  const explorer = (): EchoExplorer => ({
    on: state.on, locked: state.locked, area: WHOLE, ensemble,
    grid: state.on ? { frameId: frame.id, cols: FEATURE_COLS, rows: FEATURE_ROWS, area: WHOLE, cells: [] } : null,
    moveTo: (col, row, by) => { moves.push({ col, row, by }) },
  })
  const announce = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => createElement(AnnouncerContext.Provider, { value: announce }, children)
  const read = vi.fn(readerFor(SETS[name]))
  const hook = renderHook(() => useEcho({ visualization, frame, explorer: explorer(), read }), { wrapper })
  const point = async (target?: string) => {
    hook.rerender()
    await act(async () => { dispatch(target === undefined ? { type: 'point' } : { type: 'point', target }) })
    await act(async () => {})
  }
  return { hook, ensemble, moves, announce, point, read, visualization }
}

/** The cell each hot spot of the date resolves to, in the offline order. */
const cellsInOrder = (f: FrameFeatures) =>
  offlineOrder(f.hotspots).map(target => resolveTarget(target, f.hotspots, WHOLE, FEATURE_COLS, FEATURE_ROWS)!.cell)

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  resetActionHandlers()
})
afterEach(() => vi.useRealTimers())

describe('E on the SN02 motion set', () => {
  it('points at the largest hot spot first, then the next ones, then the centre, and wraps', async () => {
    const f = features.motion
    expect(f.hotspots.length).toBeGreaterThan(1)
    const { point, moves } = rig('motion')
    const expected = cellsInOrder(f)
    for (let press = 0; press < expected.length + 1; press++) await point()
    expect(moves.map(({ col, row }) => ({ col, row }))).toEqual([...expected, expected[0]])
    // The first is the largest spot, and the last before wrapping is the centre of the map.
    const largest = [...f.hotspots].sort((a, b) => b.cells - a.cells)[0]
    expect(moves[0]).toMatchObject(resolveTarget(largest.id, f.hotspots, WHOLE, FEATURE_COLS, FEATURE_ROWS)!.cell)
    expect(moves[expected.length - 1]).toMatchObject({ col: Math.floor(FEATURE_COLS / 2), row: Math.floor(FEATURE_ROWS / 2) })
  })

  it('moves the cursor in silence and plays three pings each time, the first at once', async () => {
    const { point, moves, ensemble } = rig('motion')
    await point()
    expect(moves[0].by).toBe('follow')
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(BEACON_GAP_MS * BEACON_PINGS) })
    expect(ensemble.playNotes).toHaveBeenCalledTimes(BEACON_PINGS)
  })

  it('says and shows where it pointed, once', async () => {
    const { point, hook, announce } = rig('motion')
    await point()
    expect(hook.result.current.text).toMatch(/^Pointing at the largest .+ area, .+\.$/)
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith(hook.result.current.text)
  })

  it('gives the same cursor place and the same pings for the same frame', async () => {
    const runs: string[] = []
    for (let run = 0; run < 2; run++) {
      const { point, moves, ensemble, hook } = rig('motion')
      await point()
      await act(async () => { await vi.advanceTimersByTimeAsync(BEACON_GAP_MS * BEACON_PINGS) })
      runs.push(JSON.stringify({ moves, notes: ensemble.playNotes.mock.calls }))
      hook.unmount()
      resetActionHandlers()
    }
    expect(runs[0]).toBe(runs[1])
  })

  it('reads the date once, ahead of the first press', async () => {
    const { point, read } = rig('motion')
    await act(async () => {})
    expect(read).toHaveBeenCalledTimes(1)
    await point()
    await point()
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('is the key E on the sound map', () => {
    const e = SHORTCUTS.find(shortcut => shortcut.id === 'point')!
    expect(e.scope).toBe('map')
    expect(e.match(keyInputOf({ key: 'e', code: 'KeyE', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false }))).toEqual({ type: 'point' })
  })
})

describe('E on the fixture', () => {
  it('points at the largest hot spot first, then the centre', async () => {
    const f = features.fixture
    const { point, moves } = rig('fixture')
    const expected = cellsInOrder(f)
    for (let press = 0; press < expected.length; press++) await point()
    expect(moves.map(({ col, row }) => ({ col, row }))).toEqual(expected)
    expect(moves.at(-1)).toMatchObject({ col: Math.floor(FEATURE_COLS / 2), row: Math.floor(FEATURE_ROWS / 2) })
  })
})

describe('a voice point', () => {
  it('reaches the same beacon at a compass place, at once, and is not announced (the guide says it)', async () => {
    const { point, moves, ensemble, hook, announce } = rig('motion')
    await point('north-east')
    expect(moves).toEqual([{ col: Math.floor((5 / 6) * FEATURE_COLS), row: Math.floor((1 / 6) * FEATURE_ROWS), by: 'follow' }])
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    expect(ensemble.playNotes.mock.calls[0][0][0].pan).toBeGreaterThan(0)
    expect(hook.result.current.text).toBe('Pointing at the north-east of the map.')
    expect(announce).not.toHaveBeenCalled()
  })

  it('points at a hot spot by its id', async () => {
    const f = features.motion
    const target = f.hotspots[1]
    const { point, moves } = rig('motion')
    await point(target.id)
    expect(moves).toEqual([{ ...resolveTarget(target.id, f.hotspots, WHOLE, FEATURE_COLS, FEATURE_ROWS)!.cell, by: 'follow' }])
  })

  it('does nothing for a target the date does not have', async () => {
    const { point, moves, ensemble, hook } = rig('motion')
    await point('h99')
    expect(moves).toEqual([])
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    expect(hook.result.current.text).toBe('')
  })

  it('says to turn on the sound map when it is off, with no sound', async () => {
    const { point, ensemble, announce } = rig('motion', { on: false, locked: false })
    await point('centre')
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    expect(announce).toHaveBeenCalledWith(OFF_TEXT)
  })

  it('keeps a locked place and says how to unlock it', async () => {
    const { point, moves, announce } = rig('motion', { on: true, locked: true })
    await point()
    expect(moves).toEqual([])
    expect(announce).toHaveBeenCalledWith(LOCKED_TEXT)
  })
})

describe('Escape', () => {
  it('stops the pings still to come', async () => {
    const { point, ensemble } = rig('motion')
    await point('centre')
    act(() => { dispatch({ type: 'stopSpeech' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(BEACON_GAP_MS * BEACON_PINGS) })
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
  })
})

describe('the visible line', () => {
  it('has no accessibility violations', async () => {
    const { point, hook } = rig('motion')
    await point()
    const { container } = render(<p className="player__follow">{hook.result.current.text}</p>)
    await expectNoA11yViolations(container)
  })
})
