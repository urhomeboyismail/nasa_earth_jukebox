// IX03 on the SN02 data set with known answers: six patches drift east by two feature cells a day, and the ones near the east edge leave the map.
import { readFileSync } from 'node:fs'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FEATURE_COLS, FEATURE_ROWS } from '../../analysis/features/types'
import { decodePng } from '../../analysis/png'
import { AnnouncerContext } from '../../components/announcerContext'
import { visualizationSchema } from '../../data/schema'
import { resetUndo, undoLast } from '../../interaction/history'
import { dispatch, resetActionHandlers } from '../../interaction/registry'
import { FOLLOW_STEP_MS, GONE_TEXT, followingText, readTracks, useFollow, type FollowExplorer, type Tracks } from './useFollow'

const DIR = 'public/data/synthetic-motion'
const visualization = visualizationSchema.parse(JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')))
type Drawn = { name: string; band: string; centre: { x: number; y: number } }
const expected = JSON.parse(readFileSync(`${DIR}/expected.json`, 'utf8')) as { frames: { hotspots: Drawn[] }[] }
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const COLS = FEATURE_COLS
const ROWS = FEATURE_ROWS

let tracks: Tracks
beforeAll(async () => {
  tracks = await readTracks(visualization, visualization.frames, async url => decodePng(readFileSync(`${DIR}/${url}`)))
})

/** The followed spot's id on frame 0 for the patch drawn as `name`: the spot nearest the drawn centre. */
const idOf = (k: number, name: string) => {
  const drawn = expected.frames[k].hotspots.find(h => h.name === name)!
  return [...tracks.features[k].hotspots].sort((a, b) => Math.hypot(a.centroid.x - drawn.centre.x, a.centroid.y - drawn.centre.y) - Math.hypot(b.centroid.x - drawn.centre.x, b.centroid.y - drawn.centre.y))[0].id
}
/** The last date each spot is on, by id. */
const lastDateOf = (id: string) => tracks.features.reduce((last, f, k) => (f.hotspots.some(h => h.id === id) ? k : last), -1)

function rig(start: { col: number; row: number }, index = 0, read: () => Promise<Tracks> = async () => tracks) {
  const ensemble = { playNotes: vi.fn(), playDropout: vi.fn(), now: vi.fn(() => 0), status: vi.fn(() => 'on' as const), start: vi.fn(async () => {}) }
  const announce = vi.fn()
  const shown: number[] = []
  const state = { cursor: start, on: true, locked: false, index }
  const explorer = (): FollowExplorer => ({
    on: state.on, locked: state.locked, cursor: state.cursor, area: WHOLE, ensemble,
    grid: { frameId: 'f', cols: COLS, rows: ROWS, area: WHOLE, cells: [] },
    moveTo: vi.fn((col: number, row: number) => { state.cursor = { col, row } }),
  })
  const moves: { col: number; row: number }[] = []
  const props = () => {
    const map = explorer()
    map.moveTo = (col, row) => { state.cursor = { col, row }; moves.push({ col, row }) }
    return {
      visualization, explorer: map, frames: visualization.frames, index: state.index, read,
      showDate: (k: number) => { state.index = k; shown.push(k) },
    }
  }
  const wrapper = ({ children }: { children: ReactNode }) => createElement(AnnouncerContext.Provider, { value: announce }, children)
  const hook = renderHook(p => useFollow(p), { initialProps: props(), wrapper })
  const update = () => hook.rerender(props())
  const press = async (step: 'toggle' | 'next' | 'previous') => {
    update()
    await act(async () => { dispatch({ type: 'follow', step }) })
    await act(async () => {})
    update()
  }
  const step = async (ms = FOLLOW_STEP_MS) => {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
    update()
  }
  return { hook, state, ensemble, announce, shown, moves, press, step, update }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  resetUndo()
  resetActionHandlers()
})
afterEach(() => vi.useRealTimers())

describe('following a hot spot on the SN02 motion set', () => {
  it('keeps the cursor within one cell of the patch on every date, and plays its note on each one', async () => {
    // The patch that stays longest: it is followed through the most dates.
    const name = expected.frames[0].hotspots.map(h => h.name).sort((a, b) => lastDateOf(idOf(0, b)) - lastDateOf(idOf(0, a)))[0]
    const drawn0 = expected.frames[0].hotspots.find(h => h.name === name)!.centre
    const { hook, press, step, moves, shown, ensemble } = rig({ col: Math.floor(drawn0.x * COLS), row: Math.floor(drawn0.y * ROWS) })
    await press('toggle')
    const id = idOf(0, name)
    expect(hook.result.current.text).toBe(followingText(id))
    const lastDate = lastDateOf(id)
    expect(lastDate).toBeGreaterThan(3)
    for (let k = 1; k <= lastDate; k++) await step()
    expect(shown).toEqual(Array.from({ length: lastDate }, (_, i) => i + 1))
    for (let k = 0; k <= lastDate; k++) {
      const drawn = expected.frames[k].hotspots.find(h => h.name === name)!.centre
      expect(Math.abs(moves[k].col - Math.floor(drawn.x * COLS)), `date ${k}`).toBeLessThanOrEqual(1)
      expect(Math.abs(moves[k].row - Math.floor(drawn.y * ROWS)), `date ${k}`).toBeLessThanOrEqual(1)
    }
    // One note per date, at the spot's own pan (the Symphony hot-spot voice's note, SN03).
    expect(ensemble.playNotes).toHaveBeenCalledTimes(lastDate + 1)
    const voice = tracks.music[0].hotspots.find(note => note.id === id)
    if (voice) expect(ensemble.playNotes.mock.calls[0][0][0]).toMatchObject({ midi: voice.midi, pan: voice.pan })
  })

  it('gives the same cursor path for the same frames', async () => {
    const paths: string[] = []
    for (let run = 0; run < 2; run++) {
      const { press, step, moves, hook } = rig({ col: 32, row: 16 })
      await press('toggle')
      for (let k = 0; k < 5; k++) await step()
      paths.push(JSON.stringify(moves))
      hook.unmount()
      resetActionHandlers()
    }
    expect(paths[0]).toBe(paths[1])
  })

  it('plays the end figure once when the spot leaves the map, says so once, and the gate drops a second sentence within 4 s', async () => {
    // Every SN02 patch stays on the map, so this one is taken off it from date 3 on: the same path as a spot that drifts off.
    const id = idOf(0, expected.frames[0].hotspots[0].name)
    const gone = 2
    const lost: Tracks = { ...tracks, features: tracks.features.map((f, k) => (k > gone ? { ...f, hotspots: f.hotspots.filter(h => h.id !== id) } : f)) }
    const centre = tracks.features[0].hotspots.find(h => h.id === id)!.centroid
    const { hook, press, step, ensemble, announce, state } = rig({ col: Math.floor(centre.x * COLS), row: Math.floor(centre.y * ROWS) }, 0, async () => lost)
    await press('toggle')
    for (let k = 0; k < gone; k++) await step()
    ensemble.playNotes.mockClear()
    await step()
    // The end figure: two notes, falling, as IX01's unlock.
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
    expect(ensemble.playNotes.mock.calls[0][0][0].midi).toBeGreaterThan(ensemble.playNotes.mock.calls[1][0][0].midi)
    expect(announce.mock.calls.filter(([said]) => said === GONE_TEXT)).toHaveLength(1)
    expect(hook.result.current.text).toBe(GONE_TEXT)
    expect(hook.result.current.isFollowing()).toBe(false)

    // Back one date and follow it again: it is lost again a step later, within 4 s, so only the sound says so.
    state.index = gone
    const back = tracks.features[gone].hotspots.find(h => h.id === id)!.centroid
    state.cursor = { col: Math.floor(back.x * COLS), row: Math.floor(back.y * ROWS) }
    await press('toggle')
    expect(hook.result.current.text).toBe(followingText(id))
    ensemble.playNotes.mockClear()
    await step()
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
    expect(announce.mock.calls.filter(([said]) => said === GONE_TEXT)).toHaveLength(1)
  })
})

describe('choosing, stopping and undoing', () => {
  it('follows the largest spot when the cursor is on none, and H again stops it, with no more steps', async () => {
    const { hook, press, step, shown } = rig({ col: 0, row: 0 })
    await press('toggle')
    const largest = [...tracks.features[0].hotspots].sort((a, b) => b.cells - a.cells)[0]
    expect(hook.result.current.text).toBe(followingText(largest.id))
    await step()
    await press('toggle')
    expect(hook.result.current.isFollowing()).toBe(false)
    expect(hook.result.current.text).toBe('')
    await step(FOLLOW_STEP_MS * 5)
    expect(shown).toEqual([1])
  })

  it('stops on Escape, with no more dates and no more notes', async () => {
    const { hook, press, step, shown, ensemble } = rig({ col: 0, row: 0 })
    await press('toggle')
    await act(async () => { dispatch({ type: 'stopSpeech' }) })
    const notes = ensemble.playNotes.mock.calls.length
    await step(FOLLOW_STEP_MS * 5)
    expect(hook.result.current.isFollowing()).toBe(false)
    expect(shown).toEqual([])
    expect(ensemble.playNotes).toHaveBeenCalledTimes(notes)
  })

  it('changes the spot with ] and [, and undo goes back to the spot before, then to not following', async () => {
    const { hook, press } = rig({ col: 0, row: 0 })
    await press('toggle')
    const first = hook.result.current.text
    await press('next')
    expect(hook.result.current.text).not.toBe(first)
    await press('previous')
    expect(hook.result.current.text).toBe(first)
    await act(async () => { undoLast() })
    expect(hook.result.current.text).not.toBe(first)
    await act(async () => { undoLast() })
    expect(hook.result.current.text).toBe(first)
    await act(async () => { undoLast() })
    expect(hook.result.current.isFollowing()).toBe(false)
  })

  it('stops when the sound map goes off, and does nothing while it is off', async () => {
    const { hook, press, step, shown, state, update } = rig({ col: 0, row: 0 })
    await press('toggle')
    state.on = false
    update()
    await step(FOLLOW_STEP_MS * 3)
    expect(shown).toEqual([])
    expect(hook.result.current.text).toBe('')
    await press('toggle')
    expect(hook.result.current.isFollowing()).toBe(false)
  })

  it('says why it cannot follow while the place is locked, and makes no sound before a press', async () => {
    const { press, state, announce, ensemble, hook } = rig({ col: 0, row: 0 })
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    state.locked = true
    await press('toggle')
    expect(announce).toHaveBeenCalledWith('Locked on this place. Press L to unlock before following a hot spot.')
    expect(hook.result.current.isFollowing()).toBe(false)
    expect(ensemble.playNotes).not.toHaveBeenCalled()
  })

  it('stays on the spot on a date the listener chooses, and plays on from there', async () => {
    const { hook, press, step, shown, state, moves } = rig({ col: 0, row: 0 })
    await press('toggle')
    const id = hook.result.current.text.replace('Following hot spot ', '').replace('.', '')
    state.index = 3
    await act(async () => { expect(hook.result.current.showFollowedDate(3)).toBe(true) })
    const spot = tracks.features[3].hotspots.find(h => h.id === id)
    if (spot) expect(moves.at(-1)).toEqual({ col: Math.floor(spot.centroid.x * COLS), row: Math.floor(spot.centroid.y * ROWS) })
    await step()
    expect(shown.at(-1)).toBe(4)
  })
})
