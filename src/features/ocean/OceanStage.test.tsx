import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnouncerContext } from '../../components/announcerContext'
import { expectNoA11yViolations } from '../../test/a11y'
import { installFakeAudioContext } from '../../test/fakes'
import OceanListen from './OceanListen'
import { indexSchema, trackSchema } from './schema'
import type { OceanSound } from './sound'

// The sound itself is tested in sound.test.ts; here it is a recording stand-in.
const fake = vi.hoisted(() => ({ made: [] as Record<string, ReturnType<typeof vi.fn>>[] }))
vi.mock('./sound', () => ({
  loadOceanSound: vi.fn(async (): Promise<OceanSound> => {
    const sound = {
      play: vi.fn(), pause: vi.fn(), seek: vi.fn(), setRate: vi.fn(), mediaTime: vi.fn(() => 0),
      probe: vi.fn(), duck: vi.fn(), preview: vi.fn(), dispose: vi.fn(),
    }
    fake.made.push(sound)
    return sound
  }),
}))

const read = (path: string) => readFileSync(`public${path}`, 'utf8')
const index = indexSchema.parse(JSON.parse(read('/data/json_output/index.json')))
const gulf = index.datasets.find(d => d.dataset_id === 'ecco2_gulf_stream')!
const gulfTrack = trackSchema.parse(JSON.parse(read(gulf.data_url)))

let audio: ReturnType<typeof installFakeAudioContext>
const announce = vi.fn()

function stubFetch(trackBody = read(gulf.data_url)) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('index.json') ? read('/data/json_output/index.json') : trackBody)))
}

function renderWith(ui: React.ReactElement) {
  return render(<AnnouncerContext.Provider value={announce}>{ui}</AnnouncerContext.Provider>)
}

beforeEach(() => {
  audio = installFakeAudioContext()
  fake.made.length = 0
  announce.mockClear()
  window.history.replaceState(null, '', `#listen?ocean=1&track=${gulf.dataset_id}`)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {})
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event('pause')) })
  stubFetch()
})

afterEach(() => {
  audio.uninstall()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '#')
})

describe('the ocean track on Listen', () => {
  it('shows the video with its poster, no autoplay, and passes the accessibility check', async () => {
    const { container } = renderWith(<OceanListen />)
    const play = await screen.findByRole('button', { name: 'Play' })
    const video = container.querySelector('video')!
    expect(video.getAttribute('src')).toBe(gulfTrack.visual_assets.video_url)
    expect(video.getAttribute('poster')).toBe(gulfTrack.visual_assets.poster_url)
    expect(video.autoplay).toBe(false)
    expect(video.muted).toBe(true)
    // jsdom has no matchMedia, which counts as reduced motion: the video is not fetched until Play.
    expect(video.getAttribute('preload')).toBe('none')
    expect(screen.getByText(gulfTrack.timeline[0].display_date, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /SVS 3912/ })).toHaveAttribute('href', 'https://svs.gsfc.nasa.gov/3912')
    expect(fake.made).toHaveLength(0)
    expect(play).toBeEnabled()
    await expectNoA11yViolations(container)
  })

  it('works by keyboard: Play, the date, the speed, Loop and Pause, with the text announced', async () => {
    const user = userEvent.setup()
    const { container } = renderWith(<OceanListen />)
    const play = await screen.findByRole('button', { name: 'Play' })
    play.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(fake.made).toHaveLength(1))
    const sound = fake.made[0]
    expect(sound.play).toHaveBeenCalledWith(0, 1)
    // Step 0 has an Echo callout: it is shown, announced and the music ducks.
    expect(screen.getByText(gulfTrack.timeline[0].echo_callout!)).toBeInTheDocument()
    expect(sound.duck).toHaveBeenCalledWith(true)
    expect(announce).toHaveBeenCalledWith(expect.stringContaining(gulfTrack.timeline[0].accessibility_text), { busy: true })

    const date = screen.getByRole('slider', { name: 'Date' })
    // jsdom's range input ignores arrow keys, so the change a key press makes is sent directly.
    fireEvent.change(date, { target: { value: '1' } })
    expect(sound.seek).toHaveBeenCalledWith(gulfTrack.timeline[1].time_sec)
    expect(date).toHaveAttribute('aria-valuetext', gulfTrack.timeline[1].display_date)

    await user.click(screen.getByRole('radio', { name: '2×' }))
    expect(sound.setRate).toHaveBeenCalledWith(2)
    expect(container.querySelector('video')!.playbackRate).toBe(2)

    await user.click(screen.getByRole('button', { name: 'Loop' }))
    expect(screen.getByRole('button', { name: 'Loop' })).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('video')!.loop).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(sound.pause).toHaveBeenCalled()
    expect(announce).toHaveBeenLastCalledWith(`Paused. ${gulfTrack.timeline[1].accessibility_text}`)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('Explore reads the grid under the reticle, moved by the arrow keys', async () => {
    const user = userEvent.setup()
    const { container } = renderWith(<OceanListen />)
    await user.click(await screen.findByRole('button', { name: 'Explore' }))
    await waitFor(() => expect(fake.made).toHaveLength(1))
    const map = screen.getByRole('application', { name: /Explore the ocean map/ })
    map.focus()
    await user.keyboard('{ArrowRight}')
    const cell = gulfTrack.timeline[0].spatial_grid![4][9]
    const probe = fake.made[0].probe
    expect(probe).toHaveBeenLastCalledWith(cell ? { sst: cell[0], pan: (9 / 15) * 2 - 1 } : 'silent')
    expect(screen.getByText(/Row 5 of 8, column 10 of 16/)).toBeInTheDocument()
    await expectNoA11yViolations(container)
    // The top-left corner of this crop is land: silent.
    for (let i = 0; i < 16; i++) await user.keyboard('{ArrowLeft}{ArrowUp}')
    expect(gulfTrack.timeline[0].spatial_grid![0][0]).toBeNull()
    expect(probe).toHaveBeenLastCalledWith('silent')
    await user.click(screen.getByRole('button', { name: 'Explore' }))
    expect(probe).toHaveBeenLastCalledWith(null)
  })

  it('shows a notice, not a crash, when a track file is not valid', async () => {
    stubFetch(JSON.stringify({ dataset_id: 'x' }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = renderWith(<OceanListen />)
    expect(await screen.findByRole('alert')).toHaveTextContent('This ocean track could not be loaded')
    await expectNoA11yViolations(container)
  })
})

const weather = index.datasets.find(d => d.dataset_id === 'meteomatics_mauritius_weather')!
const weatherTrack =trackSchema.parse(JSON.parse(read(weather.data_url)))

describe('a track made of numbers, with no video', () => {
  beforeEach(() => {
    stubFetch(read(weather.data_url))
    window.history.replaceState(null, '', `#listen?ocean=1&track=${weather.dataset_id}`)
    // jsdom cannot draw on a canvas; the picture itself is tested in CanvasGridVisualizer.test.tsx.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  it('draws the map on a canvas instead of a video, credits its own source, and passes the accessibility check', async () => {
    const { container } = renderWith(<OceanListen />)
    expect(await screen.findByRole('img', { name: /Mauritius Weather.*map of temperature/ })).toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByText('32 °C and above')).toBeInTheDocument()
    expect(screen.getByText(/Data: Meteomatics/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /SVS 3912/ })).toBeNull()
    expect(screen.getByRole('radiogroup', { name: 'Track' })).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('plays on a clock: the sound starts at 0, the date moves on, and pausing stops both', async () => {
    const user = userEvent.setup()
    renderWith(<OceanListen />)
    await user.click(await screen.findByRole('button', { name: 'Play' }))
    await waitFor(() => expect(fake.made).toHaveLength(1))
    expect(fake.made[0].play).toHaveBeenCalledWith(0, 1)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    const date = screen.getByRole('slider', { name: 'Date' })
    await waitFor(() => expect(date).not.toHaveAttribute('aria-valuetext', weatherTrack.timeline[0].display_date), { timeout: 3000 })
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(fake.made[0].pause).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('Explore reads the cell under the reticle with its wind, and sounds its temperature', async () => {
    const user = userEvent.setup()
    renderWith(<OceanListen />)
    await user.click(await screen.findByRole('button', { name: 'Explore' }))
    await waitFor(() => expect(fake.made).toHaveLength(1))
    const map = screen.getByRole('application', { name: /Explore the map/ })
    expect(map).toBeInTheDocument()
    const cell = weatherTrack.timeline[0].spatial_grid![4][8]!
    expect(fake.made[0].probe).toHaveBeenLastCalledWith({ sst: cell[0], pan: (8 / 15) * 2 - 1 })
    expect(screen.getByText(/Row 5 of 8, column 9 of 16: about [\d.]+ °C, wind speed \d+ percent from the [a-z-]+\./)).toBeInTheDocument()
  })
})

