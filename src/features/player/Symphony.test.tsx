import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { AnnouncerProvider } from '../../components'
import { expectNoA11yViolations } from '../../test/a11y'
import { installFakeAudioContext } from '../../test/fakes'
import { createFakeEnsemble, createFakeSource, withV3, type FakeEnsemble, type FakeSource } from './symphonyTestSupport'
import PlayerPage from '.'

const fakes = vi.hoisted(() => ({ ensemble: null as FakeEnsemble | null, source: null as FakeSource | null }))

// The real ensemble needs Tone, and the real source a worker and a video.
vi.mock('../../audio/ensemble/useEnsemble', async () => {
  const { useEffect, useSyncExternalStore } = await import('react')
  return {
    useEnsemble: () => {
      const e = fakes.ensemble!
      // As the real hook: the ensemble is let go of when the page goes (tested in useEnsemble.test.tsx).
      useEffect(() => () => e.ensemble.dispose(), [e])
      const status = useSyncExternalStore(e.subscribe, () => e.status)
      return { ensemble: e.ensemble, status, start: () => e.ensemble.start() }
    },
  }
})
vi.mock('../../analysis/video/useLiveSource', () => ({
  useLiveSource: (options: Parameters<FakeSource['useLiveSource']>[0]) => fakes.source!.useLiveSource(options),
}))

const plain = fixture as Visualization
const v3 = withV3(plain)
const [d1, d2] = [plain.frames[0].date, plain.frames[1].date]
const live = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''

let e: FakeEnsemble
let s: FakeSource
let audio: ReturnType<typeof installFakeAudioContext>

beforeEach(() => {
  localStorage.clear()
  e = createFakeEnsemble()
  s = createFakeSource()
  fakes.ensemble = e
  fakes.source = s
  audio = installFakeAudioContext()
})
afterEach(() => audio.uninstall())

function mount(visualization: Visualization = v3) {
  const user = userEvent.setup()
  return { user, ...render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider }) }
}
const emit = (date = d1, o?: Parameters<FakeSource['frame']>[1]) => act(() => s.options!.onFrame(s.frame(date, o)))

describe('Listen mode', () => {
  it('opens in Symphony for a data set with a sonification block', () => {
    mount()
    expect(screen.getByRole('radio', { name: 'Symphony mode' })).toBeChecked()
    expect(screen.getByRole('region', { name: 'Symphony' })).toBeInTheDocument()
  })

  it('opens in Simple for a data set without one, with the player it always had', () => {
    mount(plain)
    expect(screen.getByRole('radio', { name: 'Simple mode' })).toBeChecked()
    expect(screen.queryByRole('region', { name: 'Symphony' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Player' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simple sound' })).toBeInTheDocument()
  })

  it('lets a remembered Simple win over the default, and announces a change', async () => {
    localStorage.setItem('earth-jukebox:listen-mode', 'simple')
    const { user } = mount()
    expect(screen.getByRole('region', { name: 'Player' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Symphony mode' }))
    expect(screen.getByRole('region', { name: 'Symphony' })).toBeInTheDocument()
    expect(live()).toBe('Symphony mode. Press Play to start.')
    expect(localStorage.getItem('earth-jukebox:listen-mode')).toBe('symphony')
  })

  it('lets go of Symphony, and so of its sound, when the listener switches to Simple', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await user.click(screen.getByRole('radio', { name: 'Simple mode' }))
    expect(screen.queryByRole('region', { name: 'Symphony' })).toBeNull()
    await vi.waitFor(() => expect(e.ensemble.dispose).toHaveBeenCalled())
  })
})

describe('Symphony: starting', () => {
  it('makes no sound and starts nothing on mount', () => {
    mount()
    expect(e.ensemble.start).not.toHaveBeenCalled()
    expect(s.start).not.toHaveBeenCalled()
    expect(audio.contexts).toHaveLength(0)
  })

  it('starts the sound, then the reading, from the Play click, and plays what is read', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(e.ensemble.start).toHaveBeenCalledTimes(1)
    expect(s.start).toHaveBeenCalledTimes(1)
    expect(e.ensemble.start.mock.invocationCallOrder[0]).toBeLessThan(s.start.mock.invocationCallOrder[0])
    await emit(d1)
    expect(e.ensemble.apply).toHaveBeenCalledTimes(1)
    const [music, at] = e.ensemble.apply.mock.calls[0]
    expect(music.date).toBe(d1)
    expect(at).toBeCloseTo(10.1, 5)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('says "Turn sound on" when the browser keeps the sound suspended, does not read yet, and starts again on the next click', async () => {
    e.control.startsAs = 'suspended'
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(s.start).not.toHaveBeenCalled()
    expect(screen.getByText('The browser has turned the sound off. Press Turn sound on.')).toBeInTheDocument()
    e.control.startsAs = 'on'
    await user.click(screen.getByRole('button', { name: 'Turn sound on' }))
    expect(e.ensemble.start).toHaveBeenCalledTimes(2)
    expect(s.start).toHaveBeenCalledTimes(1)
  })

  it('plays and pauses with Space, and stops with Escape', async () => {
    const { user } = mount()
    const status = screen.getByText('Press Play to start.')
    // From the page itself, not a control: Space on a button or a field does what it does there.
    await act(async () => { fireEvent.keyDown(status, { key: ' ' }) })
    expect(e.ensemble.start).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.keyDown(status, { key: ' ' }) })
    expect(e.ensemble.pause).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.keyDown(status, { key: 'Escape' }) })
    expect(e.ensemble.stop).toHaveBeenCalledTimes(1)
    void user
  })

  it('leaves Space to a focused button', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Normal' }))
    await user.keyboard(' ')
    expect(e.ensemble.start).not.toHaveBeenCalled()
  })
})

describe('Symphony: pause, hidden page, stop', () => {
  it('pauses the sound and the reading, says Paused, and resumes both', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(e.ensemble.pause).toHaveBeenCalled()
    expect(s.stop).toHaveBeenCalled()
    expect(screen.getByText('Paused.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(e.ensemble.resume).toHaveBeenCalled()
    expect(s.start).toHaveBeenCalledTimes(2)
  })

  it('stops reading when the page is hidden, says so, and does not resume by itself', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    s.stop.mockClear()
    act(() => e.set('paused'))
    expect(s.stop).toHaveBeenCalled()
    expect(screen.getByText('Paused while the page was hidden. Press Resume to continue.')).toBeInTheDocument()
    expect(e.ensemble.resume).not.toHaveBeenCalled()
    expect(s.start).toHaveBeenCalledTimes(1)
  })

  it('stops both and clears what was read', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await emit()
    expect(screen.queryByText('Nothing is playing yet.')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(e.ensemble.stop).toHaveBeenCalled()
    expect(s.stop).toHaveBeenCalled()
    expect(screen.getByText('Nothing is playing yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled()
  })

  it('carries on reading at the new speed, from a new source, if a performance was running', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await user.click(screen.getByRole('button', { name: 'Fast' }))
    expect(s.startedAt).toEqual(['normal', 'fast'])
    expect(screen.getByRole('button', { name: 'Fast' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not start reading on a speed change before Play', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Slow' }))
    expect(s.start).not.toHaveBeenCalled()
  })

  it('lets go of the source when the page goes away', async () => {
    const { unmount } = mount()
    unmount()
    await vi.waitFor(() => expect(e.ensemble.dispose).toHaveBeenCalled())
  })
})

describe('Symphony: what is shown', () => {
  it('shows the status of a video reading with the confidence, and the Now line without a live region', async () => {
    mount()
    expect(screen.getByText('Press Play to start.')).toBeInTheDocument()
    act(() => s.set('video'))
    await emit(d1, { confidence: 0.84 })
    expect(screen.getByText('Reading the video. Reading confidence 84%.')).toBeInTheDocument()
    const now = screen.getByText('Now:').closest('p')!
    expect(now).toHaveTextContent(/^Now: .+/)
    expect(now.closest('[aria-live]')).toBeNull()
    expect(now.hasAttribute('aria-live')).toBe(false)
  })

  it('still says it is reading after a pause and a resume, when the source does not repeat its status', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    act(() => s.set('video'))
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    act(() => s.set('stopped'))
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(screen.getByText('Starting.')).toBeInTheDocument()
    await emit(d2, { confidence: 0.9 })
    expect(screen.getByText('Reading the picture. Reading confidence 90%.')).toBeInTheDocument()
  })

  it('says why the checked frames are used', async () => {
    mount()
    act(() => s.set('frames', 'The video could not be played, so the checked frames are used.'))
    await emit(d1, { confidence: 1 })
    expect(screen.getByText('Reading the checked frames. Reading confidence 100%. The video could not be played, so the checked frames are used.')).toBeInTheDocument()
  })

  it('adds the less-exact sentence below 60%, and not for a frame with nothing to read', async () => {
    mount()
    act(() => s.set('video'))
    await emit(d1, { confidence: 0.4 })
    expect(screen.getByText(/Colours may be a little off; readings may be less exact\./)).toBeInTheDocument()
    await emit(d2, { confidence: 0 })
    expect(screen.queryByText(/Colours may be a little off/)).toBeNull()
  })

  it('draws the captions for the voices that sound, hides them from a screen reader, and leaves out a muted voice', async () => {
    const { user, container } = mount()
    await emit(d1)
    const strip = container.querySelector('.symphony__captions')!
    expect(strip).toHaveAttribute('aria-hidden', 'true')
    expect(within(strip as HTMLElement).queryAllByRole('listitem')).toHaveLength(0) // hidden from the accessibility tree
    expect(strip.textContent).toContain('Melody: ')
    await user.click(screen.getByRole('button', { name: 'Mute melody' }))
    expect(container.querySelector('.symphony__captions')!.textContent).not.toContain('Melody: ')
  })

  it('shows the video, with the frame\'s alt text, only while it is the source', () => {
    const { container } = mount()
    const video = container.querySelector('video')!
    expect(video).toHaveAttribute('aria-hidden', 'true')
    act(() => s.set('video'))
    expect(video).not.toHaveAttribute('aria-hidden')
    expect(video).toHaveAttribute('aria-label', plain.frames[0].altText)
    expect(video.muted).toBe(true)
  })

  it('has no video element when the data set has none', () => {
    const { container } = mount(withV3(plain, { video: undefined }))
    expect(container.querySelector('video')).toBeNull()
  })
})

describe('Symphony: detail and mixer', () => {
  it('chooses a detail with the arrow keys, tells the ensemble through the hook, and announces what plays', async () => {
    const { user } = mount()
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Calm' }))
    expect(live()).toBe('Detail: Calm. Melody, harmony and time.')
    expect(screen.getByRole('radio', { name: 'Calm' })).toBeChecked()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()
    expect(live()).toBe('Detail: Standard. Melody, harmony, bass, hot spots and time.')
  })

  it('starts at the detail in the manifest', () => {
    mount(withV3(plain, { sonification: { preset: 'dorian', detail: 'full' } }))
    expect(screen.getByRole('radio', { name: 'Full' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Mute rhythm' })).toBeInTheDocument()
  })

  it('has a row for each voice the detail allows, and fewer at Calm', async () => {
    const { user } = mount()
    const rows = () => screen.getAllByRole('button', { name: /^Mute / }).map(b => b.textContent)
    expect(rows()).toEqual(['Mute melody', 'Mute harmony', 'Mute bass', 'Mute hot spots', 'Mute time'])
    await user.click(screen.getByRole('radio', { name: 'Calm' }))
    expect(rows()).toEqual(['Mute melody', 'Mute harmony', 'Mute time'])
  })

  it('has rows only for the voices the manifest names, and keeps the others silent', () => {
    mount(withV3(plain, { sonification: { preset: 'major', detail: 'full', voices: ['melody', 'time'] } }))
    expect(screen.getAllByRole('button', { name: /^Mute / }).map(b => b.textContent)).toEqual(['Mute melody', 'Mute time'])
    for (const voice of ['harmony', 'bass', 'hotspots', 'rhythm', 'motion']) expect(e.ensemble.mute).toHaveBeenCalledWith(voice, true)
    expect(e.ensemble.mute).not.toHaveBeenCalledWith('melody', true)
  })

  it('mutes and unmutes a voice, with aria-pressed', async () => {
    const { user } = mount()
    const button = screen.getByRole('button', { name: 'Mute melody' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await user.click(button)
    expect(e.ensemble.mute).toHaveBeenLastCalledWith('melody', true)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await user.click(button)
    expect(e.ensemble.mute).toHaveBeenLastCalledWith('melody', false)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('solos a voice, and a second press clears it', async () => {
    const { user } = mount()
    const bass = screen.getByRole('button', { name: 'Solo bass' })
    await user.click(bass)
    expect(e.ensemble.solo).toHaveBeenLastCalledWith('bass')
    expect(bass).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Solo melody' }))
    expect(e.ensemble.solo).toHaveBeenLastCalledWith('melody')
    expect(bass).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Solo melody' }))
    expect(e.ensemble.solo).toHaveBeenLastCalledWith(null)
  })
})

describe('Symphony: accessibility', () => {
  it('has no violations while idle', async () => {
    const { container } = mount()
    await expectNoA11yViolations(container)
  })

  it('has no violations while reading the video, and while reading the checked frames', async () => {
    const { container } = mount()
    act(() => s.set('video'))
    await emit(d1, { confidence: 0.8 })
    await expectNoA11yViolations(container)
    act(() => s.set('frames', 'The video could not be played, so the checked frames are used.'))
    await emit(d2)
    await expectNoA11yViolations(container)
  })

  it('has no violations in Simple mode with the mode switch', async () => {
    const { container } = mount(plain)
    await expectNoA11yViolations(container)
  })
})
