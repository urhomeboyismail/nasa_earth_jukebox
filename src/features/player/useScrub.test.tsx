import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameFeatures } from '../../analysis/features/types'
import { AnnouncerContext } from '../../components/announcerContext'
import type { Visualization } from '../../data'
import { ANSWER_BUDGET_MS } from '../../interaction/budget'
import { dispatch, resetActionHandlers } from '../../interaction/registry'
import { features, spot } from '../../sonify/testFeatures'
import { SLICE_MIN_GAP_MS, SLICE_SECONDS } from './scrub'
import { useScrub } from './useScrub'

const visualization = fixture as Visualization
const ensemble = { playNotes: vi.fn(), status: vi.fn(() => 'on' as const), start: vi.fn(async () => {}) }
const announce = vi.fn()
const chooseDate = vi.fn()
const showDate = vi.fn()
const onStep = vi.fn()
const formatDate = (date: string) => `date ${date}`

const byDate = (i: number): FrameFeatures => features({ frameId: `f${i}`, position: 0.2 + i * 0.2, hotspots: [spot('h1', 'high', 0.3, 0.4)] })
const read = vi.fn(async (_v: Visualization, frame: { id: string }) => byDate(visualization.frames.findIndex(f => f.id === frame.id)))

let carry = false
let now = 0

function Harness({ index = 0 }: { index?: number }) {
  useScrub({ visualization, index, ensemble, carryOn: () => carry, chooseDate, showDate, formatDate, onStep, read, clock: () => now })
  return null
}
const mount = (index = 0) => render(<AnnouncerContext.Provider value={announce}><Harness index={index} /></AnnouncerContext.Provider>)
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const step = (action: Parameters<typeof dispatch>[0]) => act(() => { dispatch(action) })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  for (const fn of [ensemble.playNotes, ensemble.start, announce, chooseDate, showDate, onStep, read]) fn.mockClear()
  ensemble.status.mockReturnValue('on')
  carry = false
  now = 0
  resetActionHandlers()
})
afterEach(() => { vi.useRealTimers() })

describe('useScrub', () => {
  it('moves the date and sounds a 150 ms slice of it in the same tick as the step, with no timer run', async () => {
    mount(0)
    await settle()
    // Nothing has sounded before a step.
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    const start = performance.now()
    step({ type: 'scrubTime', by: 1 })
    // Synchronous: no timer was advanced between the step and the call.
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    expect(performance.now() - start).toBeLessThan(ANSWER_BUDGET_MS)
    const notes = ensemble.playNotes.mock.calls[0][0]
    expect(notes.length).toBeGreaterThan(0)
    expect(notes.every((note: { seconds: number }) => note.seconds === SLICE_SECONDS)).toBe(true)
    expect(showDate).toHaveBeenCalledWith(1)
    expect(onStep).toHaveBeenCalledWith(1)
    expect(chooseDate).not.toHaveBeenCalled()
    expect(announce).toHaveBeenCalledWith(`date ${visualization.frames[1].date}`)
  })

  it('sounds the music of the date it lands on, not the one it left', async () => {
    mount(0)
    await settle()
    step({ type: 'scrubTime', by: 1 })
    now = 1000
    step({ type: 'scrubTime', to: 'last' })
    const [first, second] = ensemble.playNotes.mock.calls.map(call => call[0])
    expect(showDate).toHaveBeenLastCalledWith(visualization.frames.length - 1)
    expect(first).not.toEqual(second)
  })

  it('goes to the first and the last date', async () => {
    mount(2)
    await settle()
    step({ type: 'scrubTime', to: 'first' })
    expect(showDate).toHaveBeenLastCalledWith(0)
    now = 1000
    step({ type: 'scrubTime', to: 'last' })
    expect(showDate).toHaveBeenLastCalledWith(visualization.frames.length - 1)
  })

  it('says which end it is at and makes no sound when it cannot move', async () => {
    mount(0)
    await settle()
    step({ type: 'scrubTime', by: -1 })
    expect(announce).toHaveBeenCalledWith('First date.')
    expect(showDate).not.toHaveBeenCalled()
    expect(ensemble.playNotes).not.toHaveBeenCalled()
  })

  it('carries on as before, with no slice, while the dates play or a spot is followed', async () => {
    carry = true
    mount(0)
    await settle()
    step({ type: 'scrubTime', by: 1 })
    expect(chooseDate).toHaveBeenCalledWith(1)
    expect(showDate).not.toHaveBeenCalled()
    expect(ensemble.playNotes).not.toHaveBeenCalled()
  })

  it('moves the date on every repeat of a held key but sounds at most 8 slices a second', async () => {
    mount(0)
    await settle()
    for (const at of [0, 30, 60, 90, 120]) {
      now = at
      step({ type: 'scrubTime', by: 1 })
    }
    expect(showDate).toHaveBeenCalledTimes(5)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    now = SLICE_MIN_GAP_MS
    step({ type: 'scrubTime', by: 1 })
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
  })

  it('starts the sound from the press when it is off, then sounds the slice', async () => {
    ensemble.status.mockReturnValue('off' as never)
    ensemble.start.mockImplementationOnce(async () => { ensemble.status.mockReturnValue('on') })
    mount(0)
    await settle()
    step({ type: 'scrubTime', by: 1 })
    expect(ensemble.start).toHaveBeenCalledTimes(1)
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    await settle()
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
  })

  it('does not sound a slice that the browser would not let start', async () => {
    ensemble.status.mockReturnValue('off' as never)
    mount(0)
    await settle()
    step({ type: 'scrubTime', by: 1 })
    await settle()
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    expect(showDate).toHaveBeenCalledWith(1)
  })

  it('drops a slice whose date was still being read when a newer step came', async () => {
    const waiting: Array<() => void> = []
    read.mockImplementation((_v, frame) => new Promise<FrameFeatures>(resolve => {
      waiting.push(() => resolve(byDate(visualization.frames.findIndex(f => f.id === frame.id))))
    }))
    mount(0)
    step({ type: 'scrubTime', by: 1 })
    now = 500
    step({ type: 'scrubTime', by: 2 })
    act(() => { waiting.forEach(resolve => resolve()) })
    await settle()
    // Only the newest step is heard.
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    read.mockImplementation(async (_v, frame) => byDate(visualization.frames.findIndex(f => f.id === frame.id)))
  })

  it('stays silent, and still moves, when a date cannot be read', async () => {
    read.mockRejectedValueOnce(new Error('no picture'))
    mount(0)
    await settle()
    step({ type: 'scrubTime', by: 3 })
    await settle()
    expect(showDate).toHaveBeenCalledWith(3)
  })

  it('drops a slice that is still waiting when Escape is pressed', async () => {
    let finish: () => void = () => {}
    read.mockImplementation(() => new Promise<FrameFeatures>(resolve => { finish = () => resolve(byDate(1)) }))
    mount(0)
    step({ type: 'scrubTime', by: 1 })
    step({ type: 'stopSpeech' })
    act(() => finish())
    await settle()
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    read.mockImplementation(async (_v, frame) => byDate(visualization.frames.findIndex(f => f.id === frame.id)))
  })
})
