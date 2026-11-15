import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pixels } from '../../analysis/analyze'
import { AnnouncerContext } from '../../components/announcerContext'
import { expectNoA11yViolations } from '../../test/a11y'
import { installFakeAudioContext } from '../../test/fakes'
import { createFakeEnsemble, type FakeEnsemble } from '../player/symphonyTestSupport'
import { STEP_MS } from './livePictureSound'
import { LiveImages } from './LiveImages'
import type { LivePictures } from './mascotQuery'

const fakes = vi.hoisted(() => ({ ensemble: null as FakeEnsemble | null }))

// The real ensemble needs Tone: the sound engine's fake, as in the player tests.
vi.mock('../../audio/ensemble/useEnsemble', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useEnsemble: () => {
      const e = fakes.ensemble!
      const status = useSyncExternalStore(e.subscribe, () => e.status)
      return { ensemble: e.ensemble, status, start: () => e.ensemble.start() }
    },
  }
})

const base = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/57,-21,58,-20.png?item='
const pictures: LivePictures = {
  images: [
    { date: '2026-06-01', url: `${base}a` },
    { date: '2026-06-15', url: `${base}b` },
  ],
  legend: { kind: 'data', unit: '°C', stops: [{ value: 0, rgb: [0, 0, 255] }, { value: 30, rgb: [255, 0, 0] }] },
  area: [57, -21, 58, -20],
}

function filled(rgba: [number, number, number, number]): Pixels {
  const data = new Uint8ClampedArray(64 * 32 * 4)
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i)
  return { data, width: 64, height: 32 }
}

let e: FakeEnsemble
let audio: ReturnType<typeof installFakeAudioContext>
let announced: string[]

beforeEach(() => {
  e = createFakeEnsemble()
  fakes.ensemble = e
  audio = installFakeAudioContext()
  announced = []
})
afterEach(() => {
  vi.useRealTimers()
  audio.uninstall()
})

function show(load: (url: string) => Promise<Pixels> = async url => filled(url.endsWith('a') ? [0, 0, 255, 255] : [255, 0, 0, 255])) {
  return render(
    <AnnouncerContext.Provider value={text => announced.push(text)}>
      <LiveImages pictures={pictures} load={load} />
    </AnnouncerContext.Provider>,
  )
}

describe('LiveImages', () => {
  it('shows the first picture with its alt text and date, says it is reading, and passes the accessibility check', async () => {
    const { container } = show()
    expect(screen.getByRole('status')).toHaveTextContent('Reading the pictures…')
    const img = screen.getByRole('img', { name: 'Map of values in °C on 1 June 2026, 57° to 58°, -21° to -20°.' })
    expect(img).toHaveAttribute('src', pictures.images[0].url)
    expect(img).toHaveAttribute('crossorigin', 'anonymous')
    expect(screen.getByText('Picture 1 of 2: 1 June 2026')).toBeInTheDocument()
    expect(screen.getByText('Imagery: Microsoft Planetary Computer')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Play the pictures' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('Next and Previous step through the pictures, disabled at the ends', async () => {
    show()
    const previous = screen.getByRole('button', { name: 'Previous' })
    const next = screen.getByRole('button', { name: 'Next' })
    expect(previous).toBeDisabled()
    await userEvent.click(next)
    expect(screen.getByRole('img', { name: /on 15 June 2026/ })).toHaveAttribute('src', pictures.images[1].url)
    expect(next).toBeDisabled()
    await userEvent.click(previous)
    expect(screen.getByText('Picture 1 of 2: 1 June 2026')).toBeInTheDocument()
  })

  it('makes no sound before the click; Play applies a frame per picture, announces each caption, and stops after the last', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    show()
    await screen.findByRole('button', { name: 'Play the pictures' })
    expect(e.ensemble.start).not.toHaveBeenCalled()
    expect(e.ensemble.apply).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Play the pictures' }))
    expect(e.ensemble.start).toHaveBeenCalledTimes(1)
    expect(e.ensemble.apply).toHaveBeenCalledTimes(1)
    const first = e.ensemble.apply.mock.calls[0][0]
    expect(first).toMatchObject({ frameId: 'live-1', date: '2026-06-01', dropout: false })
    expect(announced).toEqual([first.summary])
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()

    await act(async () => { vi.advanceTimersByTime(STEP_MS) })
    expect(e.ensemble.apply).toHaveBeenCalledTimes(2)
    expect(e.ensemble.apply.mock.calls[1][0].melody.midi).toBeGreaterThan(first.melody.midi)
    expect(screen.getByText('Picture 2 of 2: 15 June 2026')).toBeInTheDocument()
    expect(announced).toHaveLength(2)

    await act(async () => { vi.advanceTimersByTime(STEP_MS) })
    expect(e.ensemble.stop).toHaveBeenCalled()
    expect(e.status).toBe('off')
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled()
  })

  it('Stop silences the pictures', async () => {
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Play the pictures' }))
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(e.status).toBe('off')
    expect(screen.getByRole('button', { name: 'Play the pictures' })).toBeEnabled()
  })

  it('a picture that did not load says so, and plays as a dropout', async () => {
    show(async url => {
      if (url.endsWith('a')) throw new Error('blocked')
      return filled([255, 0, 0, 255])
    })
    expect(await screen.findByText('This picture did not load.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Play the pictures' }))
    expect(e.ensemble.apply.mock.calls[0][0].dropout).toBe(true)
    expect(announced[0]).toMatch(/^This picture did not load\./)
  })
})
