import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameFeatures } from '../../analysis/features/types'
import { AnnouncerContext } from '../../components/announcerContext'
import type { Visualization } from '../../data'
import { dispatch, resetActionHandlers } from '../../interaction/registry'
import { features, spot } from '../../sonify/testFeatures'
import { expectNoA11yViolations } from '../../test/a11y'
import { onPredictDone, requestPredict } from './bus'
import { PredictPanel } from './PredictPanel'
import { DATE_GAP_MS, usePredict, type PredictFeatureReader } from './usePredict'

const visualization = fixture as Visualization
const ensemble = { playNotes: vi.fn(), now: vi.fn(() => 0), status: vi.fn(() => 'on' as const), start: vi.fn(async () => {}), stop: vi.fn() }
const announce = vi.fn()
const halt = vi.fn()
const showDate = vi.fn()

const sized = (cells: number) => ({ ...spot('h1', 'high', 0.5, 0.5), cells })
const frame = (id: string, hotspots = [sized(40)], position = 0.5) => features({ frameId: id, hotspots, position })

/** Frames 0, 1, 2 hold one tracked warm spot that grows (40, 50, 60 cells). The date after that has none. */
const tracked: Record<string, FrameFeatures> = {
  [visualization.frames[0].id]: frame('a', [sized(40)], 0.3),
  [visualization.frames[1].id]: frame('b', [sized(50)], 0.5),
  [visualization.frames[2].id]: frame('c', [sized(60)], 0.8),
  [visualization.frames[3].id]: frame('d', []),
}
const readTracked: PredictFeatureReader = async (_v, f) => tracked[f.id]
const readUntracked: PredictFeatureReader = async (_v, f) => ({ ...tracked[f.id], hotspots: f.id === visualization.frames[2].id ? [] : tracked[f.id].hotspots })

function Harness({ read, index = 0 }: { read: PredictFeatureReader; index?: number }) {
  const predict = usePredict({ visualization, index, ensemble, halt, showDate, read })
  return <PredictPanel predict={predict} index={index} />
}
const view = (read: PredictFeatureReader, index = 0) => render(<AnnouncerContext.Provider value={announce}><Harness read={read} index={index} /></AnnouncerContext.Provider>)

const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const predictButton = () => screen.getByRole('button', { name: 'Predict' })
const press = async (name: string) => {
  await act(async () => { screen.getByRole('button', { name }).click() })
  await settle()
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  Object.values(ensemble).forEach(fn => fn.mockClear())
  ensemble.now.mockReturnValue(0)
  ensemble.status.mockReturnValue('on')
  announce.mockClear()
  halt.mockClear()
  showDate.mockClear()
  resetActionHandlers()
})
afterEach(() => { vi.useRealTimers() })

describe('PredictPanel', () => {
  it('offers Predict on a date with a tracked warm spot, and makes no sound before it is pressed', async () => {
    view(readTracked)
    expect(screen.queryByRole('button', { name: 'Predict' })).toBeNull()
    await settle()
    expect(predictButton()).toBeTruthy()
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Bigger' })).toBeNull()
  })

  it('offers no question on a date whose spot is not tracked two dates later', async () => {
    view(readUntracked)
    await settle()
    expect(screen.queryByRole('button', { name: 'Predict' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Predict' })).toBeNull()
  })

  it('offers no question on a date with fewer than two dates after it', async () => {
    view(readTracked, visualization.frames.length - 1)
    await settle()
    expect(screen.queryByRole('button', { name: 'Predict' })).toBeNull()
  })

  it('shows the choices only after Predict, with the date playing as the question, and keeps the answer off the page until the reveal', async () => {
    view(readTracked)
    await settle()
    await press('Predict')
    expect(halt).toHaveBeenCalledTimes(1)
    expect(showDate).toHaveBeenCalledWith(0)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    for (const name of ['Bigger', 'Smaller', 'About the same']) expect(screen.getByRole('button', { name })).toBeTruthy()
    expect(screen.getByText('Will the warm area get bigger, smaller, or stay about the same?')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/It got|It stayed|You said/)
    expect(announce).not.toHaveBeenCalled()
  })

  it('plays the two later dates at 0 and 800 ms after the choice, then says the answer once', async () => {
    view(readTracked)
    await settle()
    await press('Predict')
    ensemble.playNotes.mockClear()
    await press('Bigger')
    // The first later date sounds at once, the second at +800 ms.
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).not.toMatch(/It got|You said/)
    await tick(DATE_GAP_MS - 1)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
    expect(announce).not.toHaveBeenCalled()
    await tick(DATE_GAP_MS)
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith('You said bigger. It got bigger.')
    expect(screen.getByText('You said bigger. It got bigger.')).toBeTruthy()
    await tick(5000)
    expect(announce).toHaveBeenCalledTimes(1)
  })

  it('says the same in words and sounds a rising pair when right, a falling pair when wrong', async () => {
    const answerNotes = async (choice: string) => {
      const { unmount } = view(readTracked)
      await settle()
      await press('Predict')
      ensemble.playNotes.mockClear()
      await press(choice)
      await tick(2 * DATE_GAP_MS + 1000)
      // Calls: the two dates, then the two notes of the answer.
      const midis = ensemble.playNotes.mock.calls.slice(2).map(call => call[0][0].midi as number)
      unmount()
      return { midis, said: announce.mock.calls.at(-1)?.[0] as string }
    }
    const right = await answerNotes('Bigger')
    announce.mockClear()
    const wrong = await answerNotes('Smaller')
    expect(right.midis).toHaveLength(2)
    expect(right.midis[1]).toBeGreaterThan(right.midis[0])
    expect(wrong.midis).toHaveLength(2)
    expect(wrong.midis[1]).toBeLessThan(wrong.midis[0])
    expect(right.said).toBe('You said bigger. It got bigger.')
    expect(wrong.said).toBe('You said smaller. It got bigger.')
  })

  it('stops the question and its sound on Escape', async () => {
    view(readTracked)
    await settle()
    await press('Predict')
    act(() => { dispatch({ type: 'stopSpeech' }) })
    expect(ensemble.stop).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Bigger' })).toBeNull()
    await tick(5000)
    expect(announce).not.toHaveBeenCalled()
  })

  it('asks for the demo, and tells the demo when the answer is given', async () => {
    view(readTracked)
    await settle()
    const done = vi.fn()
    const off = onPredictDone(done)
    act(() => { requestPredict() })
    await settle()
    expect(screen.getByRole('button', { name: 'Bigger' })).toBeTruthy()
    expect(done).not.toHaveBeenCalled()
    await press('Bigger')
    await tick(2 * DATE_GAP_MS)
    expect(done).toHaveBeenCalledTimes(1)
    off()
  })

  // axe waits on real timers, so each check switches to them last.
  it('has no accessibility violations before the question', async () => {
    const { container } = view(readTracked)
    await settle()
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations while the question is asked', async () => {
    const { container } = view(readTracked)
    await settle()
    await press('Predict')
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations after the reveal', async () => {
    const { container } = view(readTracked)
    await settle()
    await press('Predict')
    await press('Smaller')
    await tick(2 * DATE_GAP_MS + 1000)
    expect(screen.getByText('You said smaller. It got bigger.')).toBeTruthy()
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})
