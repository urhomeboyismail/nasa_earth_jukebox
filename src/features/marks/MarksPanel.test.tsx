import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameGrid } from '../../analysis'
import { AnnouncerProvider } from '../../components'
import type { Visualization } from '../../data'
import { resetUndo } from '../../interaction/history'
import { markNote } from '../../interaction/notes'
import { PRESETS } from '../../sonify/presets'
import { expectNoA11yViolations } from '../../test/a11y'
import PlayerPage from '../player'
import { RECORD_LIMIT_S, stepsFromLog } from './record'
import { renderRecording } from './renderRecording'
import { resetMarksStore } from './store'

const visualization = fixture as Visualization
const COLS = 24
const ROWS = 12

const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => {}), setStyle: vi.fn(), setSpatial: vi.fn(), setVolume: vi.fn(), playCategory: vi.fn(), playMissing: vi.fn(),
  playSequence: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn(), renderToWav: vi.fn(),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))

const ensemble = vi.hoisted(() => ({
  hold: vi.fn(), playNotes: vi.fn(), playDropout: vi.fn(), now: vi.fn(() => 0), status: vi.fn(() => 'off' as const), start: vi.fn(async () => {}), setDetail: vi.fn(),
}))
vi.mock('../../audio/ensemble/useEnsemble', () => ({ useEnsemble: () => ({ ensemble, status: 'off', start: ensemble.start }) }))

const analyzeAll = vi.hoisted(() => vi.fn())
const analyzeGrid = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll, analyzeGrid }))

vi.mock('./renderRecording', () => ({ renderRecording: vi.fn() }))

const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const
const makeGrid = (frameId: string): FrameGrid => ({
  frameId, cols: COLS, rows: ROWS, area: { x0: 0, y0: 0, x1: 1, y1: 1 },
  cells: Array.from({ length: COLS * ROWS }, () => ({ value: 15, category: 'mild' })),
})

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const played = () => ensemble.playNotes.mock.calls.map(([notes]) => notes as { midi: number; seconds: number }[])
/** The cursor starts in the middle of the map: column 13, row 7, which is "centre". */
const FIRST_MARK = 'January 2024, centre, column 13, row 7.'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  Object.values(engine).forEach(fn => fn.mockClear())
  Object.values(ensemble).forEach(fn => fn.mockClear())
  vi.mocked(renderRecording).mockReset()
  resetUndo()
  localStorage.clear()
  resetMarksStore()
  analyzeAll.mockReset()
  analyzeAll.mockImplementation(async () => visualization.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: CATEGORIES[i] })))
  analyzeGrid.mockReset()
  analyzeGrid.mockImplementation(async (frame: { id: string }) => makeGrid(frame.id))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); resetMarksStore() })

async function exploring() {
  const user = userEvent.setup({ delay: null })
  const view = render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
  await tick(0)
  await user.click(screen.getByRole('button', { name: 'Explore the map' }))
  await tick(0)
  return { user, ...view }
}
const marksList = () => within(screen.getByRole('list', { name: 'Marks' }))

describe('MarksPanel: marking', () => {
  it('says there are no marks yet', async () => {
    await exploring()
    expect(screen.getByText('No marks yet.')).toBeInTheDocument()
  })

  it('M marks the date and place with one bright note, lists it as text, and says nothing aloud', async () => {
    const { user } = await exploring()
    ensemble.playNotes.mockClear()
    await user.keyboard('m')
    expect(played()).toHaveLength(1)
    expect(played()[0][0].midi).toBe(markNote(PRESETS.major))
    expect(played()[0][0].seconds).toBe(0.5)
    expect(marksList().getByText(FIRST_MARK)).toBeInTheDocument()
    expect(document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? '').toBe('')
  })

  it('keeps the marks after a reload', async () => {
    const first = await exploring()
    await first.user.keyboard('m')
    first.unmount()
    resetMarksStore()
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    // The map has not been read on this visit, so the place is said by column and row.
    expect(marksList().getByText('January 2024, column 13, row 7.')).toBeInTheDocument()
  })

  it('removes a mark with its button, and Ctrl+Z puts it back', async () => {
    const { user } = await exploring()
    await user.keyboard('m')
    await user.click(screen.getByRole('button', { name: `Remove mark ${FIRST_MARK.slice(0, -1)}` }))
    expect(screen.getByText('No marks yet.')).toBeInTheDocument()
    await user.keyboard('{Control>}z{/Control}')
    expect(marksList().getByText(FIRST_MARK)).toBeInTheDocument()
  })

  it('takes a mark back with Ctrl+Z', async () => {
    const { user } = await exploring()
    await user.keyboard('m')
    await user.keyboard('{Control>}z{/Control}')
    expect(screen.getByText('No marks yet.')).toBeInTheDocument()
  })
})

describe('MarksPanel: sharing', () => {
  it('copies a link for the marked date and cell and says so', async () => {
    const { user } = await exploring()
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await user.keyboard('m')
    await user.click(screen.getByRole('button', { name: `Copy link to mark ${FIRST_MARK.slice(0, -1)}` }))
    await tick(0)
    expect(write).toHaveBeenCalledTimes(1)
    const link = String((write.mock.calls[0] as unknown[])[0])
    expect(link).toContain(`date=${visualization.frames[0].date}`)
    expect(link).toContain('cell=12%2C6')
    expect(screen.getByText('Link copied.')).toBeInTheDocument()
  })

  it('shows the link in a field to copy by hand when the clipboard is missing', async () => {
    const { user } = await exploring()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('refused'))
    await user.keyboard('m')
    await user.click(screen.getByRole('button', { name: `Copy link to mark ${FIRST_MARK.slice(0, -1)}` }))
    await tick(0)
    expect(screen.getByRole('textbox', { name: 'Link to copy' })).toHaveDisplayValue(/cell=12%2C6/)
  })
})

describe('MarksPanel: recording', () => {
  it('records, shows the time as text, and offers the WAV as a download', async () => {
    const created = vi.fn(() => 'blob:recording')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }))
    vi.mocked(renderRecording).mockResolvedValue(new Blob(['x'], { type: 'audio/wav' }))
    const { user } = await exploring()
    await user.click(screen.getByRole('button', { name: 'Start recording' }))
    expect(screen.getByText('Recording: 0 seconds.')).toBeInTheDocument()
    await user.click(screen.getByRole('slider', { name: 'Date' }))
    await tick(5000)
    expect(screen.getByText('Recording: 5 seconds.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop and download' }))
    await tick(0)
    expect(renderRecording).toHaveBeenCalledTimes(1)
    const log = vi.mocked(renderRecording).mock.calls[0][1]
    expect(stepsFromLog(log)[0]).toEqual({ index: 0, atSeconds: 0 })
    const link = screen.getByRole('link', { name: /Download the recording/ })
    expect(link).toHaveAttribute('href', 'blob:recording')
    expect(link.getAttribute('download')).toMatch(/^fixture-\d{8}-\d{6}\.wav$/)
  })

  it('stops by itself at the limit, and says so in the text', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:r'), revokeObjectURL: vi.fn() }))
    vi.mocked(renderRecording).mockResolvedValue(new Blob(['x']))
    const { user } = await exploring()
    await user.click(screen.getByRole('button', { name: 'Start recording' }))
    await tick(RECORD_LIMIT_S * 1000 + 600)
    expect(renderRecording).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/stopped by itself at 2 minutes 50 seconds/)).toBeInTheDocument()
  })

  it('says why when the file could not be made', async () => {
    vi.mocked(renderRecording).mockRejectedValue(new Error('That is too long to render (over 3 minutes).'))
    const { user } = await exploring()
    await user.click(screen.getByRole('button', { name: 'Start recording' }))
    await user.click(screen.getByRole('button', { name: 'Stop and download' }))
    await tick(0)
    expect(screen.getByRole('alert')).toHaveTextContent('too long to render')
  })
})

describe('MarksPanel: accessibility', () => {
  // axe needs real timers.
  beforeEach(() => { vi.useRealTimers() })

  it('has no violations with marks listed, a copied link and a finished recording', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await screen.findByRole('button', { name: 'Start recording' })
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('refused'))
    localStorage.setItem('earth-jukebox:marks', JSON.stringify([{ dataId: visualization.id, date: visualization.frames[0].date, col: 3, row: 2, at: '2026-11-13T09:00:00.000Z' }]))
    act(() => { resetMarksStore() })
    await user.click(await screen.findByRole('button', { name: /^Copy link to mark/ }))
    await screen.findByRole('textbox', { name: 'Link to copy' })
    await expectNoA11yViolations(container)
  })
})
