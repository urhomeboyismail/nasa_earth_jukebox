import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Pixels } from '../../analysis/analyze'
import { FEATURE_COLS, FEATURE_ROWS, type FrameFeatures } from '../../analysis/features/types'
import { SCHEDULE_LOOKAHEAD_S } from '../../audio/ensemble/constants'
import { AnnouncerProvider } from '../../components'
import { AnnouncerContext } from '../../components/announcerContext'
import type { Visualization } from '../../data'
import { PRESETS } from '../../sonify/presets'
import { scanPlan, SCAN_MS_PER_COLUMN } from '../../sonify/scan'
import { features } from '../../sonify/testFeatures'
import { expectNoA11yViolations } from '../../test/a11y'
import { installFakeAudioContext } from '../../test/fakes'
import { createFakeEnsemble, withV3, type FakeEnsemble } from './symphonyTestSupport'
import PlayerPage from '.'
import { Scan } from './Scan'

const fakes = vi.hoisted(() => ({ ensemble: null as FakeEnsemble | null, features: null as ((frameId: string) => Promise<unknown>) | null }))

// The real ensemble needs Tone, and the real reading a worker.
vi.mock('../../audio/ensemble/useEnsemble', async () => {
  const { useEffect, useSyncExternalStore } = await import('react')
  return {
    useEnsemble: () => {
      const e = fakes.ensemble!
      useEffect(() => () => e.ensemble.dispose(), [e])
      const status = useSyncExternalStore(e.subscribe, () => e.status)
      return { ensemble: e.ensemble, status, start: () => e.ensemble.start() }
    },
  }
})
vi.mock('./scanFeatures', async importOriginal => ({
  ...(await importOriginal<typeof import('./scanFeatures')>()),
  scanFeatures: (_visualization: unknown, frame: { id: string }) => fakes.features!(frame.id),
}))

// The reading itself is tested below, against the module the mock above leaves out.
const { clearScanFeatures, scanFeatures: realScanFeatures } = await vi.importActual<typeof import('./scanFeatures')>('./scanFeatures')

const plain = fixture as Visualization
const preset = PRESETS.major
const live = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''
const TOTAL_S = (FEATURE_COLS * SCAN_MS_PER_COLUMN) / 1000

/** A frame with a readable grid; `unreadable` columns cannot be read. */
function gridFeatures(unreadable: (column: number) => boolean = () => false): FrameFeatures {
  const position = new Float32Array(FEATURE_COLS * FEATURE_ROWS)
  for (let row = 0; row < FEATURE_ROWS; row++) {
    for (let column = 0; column < FEATURE_COLS; column++) position[row * FEATURE_COLS + column] = unreadable(column) ? Number.NaN : (row + 1) / (FEATURE_ROWS + 1)
  }
  return { ...features(), grid: { cols: FEATURE_COLS, rows: FEATURE_ROWS, values: position.slice(), position } }
}

let e: FakeEnsemble
let audio: ReturnType<typeof installFakeAudioContext>
let time = 10
let frames: FrameFeatures
let frameQueue: (() => void)[] = []

beforeEach(() => {
  localStorage.clear()
  e = createFakeEnsemble()
  time = 10
  e.ensemble.now = () => time
  fakes.ensemble = e
  frames = gridFeatures()
  fakes.features = () => Promise.resolve(frames)
  audio = installFakeAudioContext()
  frameQueue = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frameQueue.push(() => callback(0)))
  vi.stubGlobal('cancelAnimationFrame', () => { frameQueue = [] })
})
afterEach(() => {
  audio.uninstall()
  vi.unstubAllGlobals()
})

/** Runs the animation frame the loop asked for. */
const tick = () => act(async () => {
  const run = frameQueue
  frameQueue = []
  run.forEach(callback => callback())
})
const startsAt = 10 + SCHEDULE_LOOKAHEAD_S
const lineEl = () => document.querySelector('.scan__line')

function mount(visualization: Visualization = plain) {
  const user = userEvent.setup()
  return { user, ...render(<Scan visualization={visualization} />, { wrapper: AnnouncerProvider }) }
}
async function scan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Scan from the west edge' }))
}

describe('Scan: starting', () => {
  it('makes no sound until the button is pressed', () => {
    mount()
    expect(e.ensemble.start).not.toHaveBeenCalled()
    expect(e.ensemble.playNotes).not.toHaveBeenCalled()
    expect(screen.getByText('Press Scan from the west edge to hear this date as a sweep.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop scan' })).toBeDisabled()
  })

  it('starts the audio from the click and plays one chord per column at its time', async () => {
    frames = gridFeatures(column => column === 3 || column === 4)
    const { user } = mount()
    await scan(user)
    expect(e.ensemble.start).toHaveBeenCalledTimes(1)
    const plan = scanPlan(frames, preset)
    const played = e.ensemble.playNotes.mock.calls
    const dropped = e.ensemble.playDropout.mock.calls
    expect(played).toHaveLength(62)
    expect(dropped).toHaveLength(2)
    const expected = plan.filter(column => !column.dropout)
    played.forEach(([notes, at], i) => {
      expect(notes).toEqual(expected[i].notes)
      expect(at).toBeCloseTo(startsAt + expected[i].atMs / 1000)
    })
    expect(dropped.map(([at]) => at)).toEqual([startsAt + 3 * 0.08, startsAt + 4 * 0.08].map(value => expect.closeTo(value)))
    // In order: the times only grow.
    const times = [...played.map(([, at]) => at as number)]
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('says the scan starts, and it says nothing for each column', async () => {
    const spoken: string[] = []
    const user = userEvent.setup()
    render(<AnnouncerContext.Provider value={text => spoken.push(text)}><Scan visualization={plain} /></AnnouncerContext.Provider>)
    await scan(user)
    expect(spoken).toEqual(['Scanning from the west edge. About five seconds.'])
    for (const seconds of [0.5, 1, 2, 3, 4]) {
      time = startsAt + seconds
      await tick()
    }
    expect(spoken).toHaveLength(1)
  })
})

describe('Scan: the line', () => {
  it('shows the line at the column the audio clock has reached, hidden from screen readers', async () => {
    const { user } = mount()
    await scan(user)
    time = startsAt + 2.5
    await tick()
    const line = lineEl()!
    expect(line).toHaveAttribute('aria-hidden', 'true')
    expect(line).toHaveAttribute('data-column', '31')
  })

  it('slides smoothly across the picture', async () => {
    const { user } = mount()
    await scan(user)
    time = startsAt + 2.55
    await tick()
    // 2.55 s of 5.12 s, across the whole image.
    expect(parseFloat((lineEl() as HTMLElement).style.left)).toBeCloseTo((2.55 / TOTAL_S) * 100, 3)
  })

  it('jumps from column to column with reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const { user } = mount()
    await scan(user)
    time = startsAt + 2.55
    await tick()
    expect(parseFloat((lineEl() as HTMLElement).style.left)).toBeCloseTo((31 / 64) * 100, 3)
  })

  it('stays on the first column until the sound begins', async () => {
    const { user } = mount()
    await scan(user)
    time = 10
    await tick()
    expect(lineEl()).toHaveAttribute('data-column', '0')
  })

  it('ends after the last column: the line goes and the end is announced once', async () => {
    const { user } = mount()
    await scan(user)
    time = startsAt + TOTAL_S + 0.01
    await tick()
    expect(lineEl()).toBeNull()
    expect(live()).toBe('Scan finished.')
    expect(screen.getByRole('button', { name: 'Scan from the west edge' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Stop scan' })).toBeDisabled()
    expect(e.ensemble.stop).not.toHaveBeenCalled()
  })
})

describe('Scan: focus', () => {
  it('moves focus to Stop scan while it runs and back to Scan when it ends, so it is never lost to the page', async () => {
    const { user } = mount()
    await scan(user)
    expect(screen.getByRole('button', { name: 'Stop scan' })).toHaveFocus()
    time = startsAt + TOTAL_S + 0.01
    await tick()
    expect(screen.getByRole('button', { name: 'Scan from the west edge' })).toHaveFocus()
  })
})

describe('Scan: stopping', () => {
  it('stops with the button', async () => {
    const { user } = mount()
    await scan(user)
    await tick()
    await user.click(screen.getByRole('button', { name: 'Stop scan' }))
    expect(e.ensemble.stop).toHaveBeenCalledTimes(1)
    expect(lineEl()).toBeNull()
    expect(live()).toBe('Scan stopped.')
  })

  it('stops with Escape', async () => {
    const { user } = mount()
    await scan(user)
    await tick()
    await user.keyboard('{Escape}')
    expect(e.ensemble.stop).toHaveBeenCalledTimes(1)
    expect(lineEl()).toBeNull()
    expect(live()).toBe('Scan stopped.')
  })

  it('does nothing on Escape when no scan is running', async () => {
    const { user } = mount()
    await user.keyboard('{Escape}')
    expect(e.ensemble.stop).not.toHaveBeenCalled()
  })

  it('ignores a picture that finishes being read after Stop', async () => {
    let finish: (value: FrameFeatures) => void = () => {}
    fakes.features = () => new Promise(resolve => { finish = resolve as (value: FrameFeatures) => void })
    const { user } = mount()
    await scan(user)
    expect(screen.getByText('Reading the picture.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop scan' }))
    await act(async () => finish(gridFeatures()))
    expect(e.ensemble.playNotes).not.toHaveBeenCalled()
    expect(lineEl()).toBeNull()
    expect(screen.getByRole('button', { name: 'Scan from the west edge' })).toBeEnabled()
  })

  it('ends when the page hides and the ensemble pauses itself', async () => {
    const { user } = mount()
    await scan(user)
    await tick()
    act(() => e.set('paused'))
    expect(lineEl()).toBeNull()
    expect(live()).toBe('Scan stopped.')
  })

  it('stops the loop when the mode changes away from Scan', async () => {
    const { user, unmount } = mount()
    await scan(user)
    await tick()
    unmount()
    expect(frameQueue).toEqual([])
    await vi.waitFor(() => expect(e.ensemble.dispose).toHaveBeenCalled())
  })
})

describe('Scan: what it says when it cannot sweep', () => {
  it('says there is not enough data when no column can be read, and plays one cue', async () => {
    frames = gridFeatures(() => true)
    const { user } = mount()
    await scan(user)
    expect(screen.getByText('Not enough data to scan this date.', { selector: 'p' })).toBeInTheDocument()
    expect(live()).toBe('Not enough data to scan this date.')
    expect(e.ensemble.playNotes).not.toHaveBeenCalled()
    expect(e.ensemble.playDropout).toHaveBeenCalledTimes(1)
    expect(lineEl()).toBeNull()
  })

  it('does not say it for a scan with only some columns missing', async () => {
    frames = gridFeatures(column => column < 10)
    const { user } = mount()
    await scan(user)
    expect(screen.queryByText(/Not enough data/)).toBeNull()
    expect(e.ensemble.playDropout).toHaveBeenCalledTimes(10)
  })

  it('says so when the browser has turned the sound off', async () => {
    e.control.startsAs = 'suspended'
    const { user } = mount()
    await scan(user)
    expect(screen.getByText(/The browser has turned the sound off/)).toBeInTheDocument()
    expect(e.ensemble.playNotes).not.toHaveBeenCalled()
  })

  it('says so when the picture cannot be read', async () => {
    fakes.features = () => Promise.reject(new Error('No picture.'))
    const { user } = mount()
    await scan(user)
    expect(screen.getByText('The picture could not be read. No picture.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scan from the west edge' })).toBeEnabled()
  })
})

describe('Scan: dates', () => {
  it('scans the date chosen on the slider, and the slider waits while a scan runs', async () => {
    const asked: string[] = []
    fakes.features = id => { asked.push(id); return Promise.resolve(frames) }
    const { user } = mount()
    const slider = screen.getByRole('slider', { name: 'Date' })
    fireEvent.change(slider, { target: { value: '1' } })
    await scan(user)
    expect(asked).toEqual([plain.frames[1].id])
    expect(slider).toBeDisabled()
  })
})

describe('Scan: accessibility', () => {
  it('has no violations, idle or scanning', async () => {
    const { container, user } = mount()
    await expectNoA11yViolations(container)
    await scan(user)
    await tick()
    await expectNoA11yViolations(container)
  })
})

describe('Scan in the Listen page', () => {
  it('is the third choice, and choosing it stops what was playing', async () => {
    const user = userEvent.setup()
    render(<PlayerPage visualization={withV3(plain)} />, { wrapper: AnnouncerProvider })
    expect(screen.getAllByRole('radio', { name: /mode|^Scan$/ }).map(radio => radio.closest('label')?.textContent)).toEqual(['Symphony mode', 'Simple mode', 'Scan'])
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await user.click(screen.getByRole('radio', { name: 'Scan' }))
    expect(screen.getByRole('region', { name: 'Scan' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Symphony' })).toBeNull()
    expect(live()).toBe('Scan. Press Scan from the west edge to start.')
    expect(localStorage.getItem('earth-jukebox:listen-mode')).toBe('scan')
  })
})

describe('scanFeatures', () => {
  const pixels: Pixels = { data: new Uint8ClampedArray(4), width: 1, height: 1 }
  const frame = plain.frames[0]
  beforeEach(clearScanFeatures)

  function deps(extract = vi.fn(async () => gridFeatures())) {
    return { extract, loadPixels: vi.fn(async () => pixels), loadBitmap: vi.fn(async () => ({ close: vi.fn() }) as unknown as ImageBitmap) }
  }

  it('reads the frame with the data set legend and keeps the result by frame', async () => {
    const d = deps()
    const first = await realScanFeatures(plain, frame, d)
    const second = await realScanFeatures(plain, frame, d)
    expect(second).toBe(first)
    expect(d.extract).toHaveBeenCalledTimes(1)
    const [stream, , input] = d.extract.mock.calls[0] as unknown as [string, unknown, { frameId: string; date: string; mode: string; colourTolerance: number }]
    expect(stream).toBe('scan')
    expect(input).toMatchObject({ frameId: frame.id, date: frame.date, colourTolerance: 1 })
  })

  it('reads another frame separately', async () => {
    const d = deps()
    await realScanFeatures(plain, plain.frames[0], d)
    await realScanFeatures(plain, plain.frames[1], d)
    expect(d.extract).toHaveBeenCalledTimes(2)
  })

  it('does not keep a failure, so a retry can succeed', async () => {
    const failing = deps(vi.fn(async () => { throw new Error('No worker.') }))
    await expect(realScanFeatures(plain, frame, failing)).rejects.toThrow('No worker.')
    const working = deps()
    await expect(realScanFeatures(plain, frame, working)).resolves.toBeDefined()
    expect(working.extract).toHaveBeenCalledTimes(1)
  })
})
