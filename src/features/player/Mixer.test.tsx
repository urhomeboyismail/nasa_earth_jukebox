// The Symphony mixer from the keyboard, its words, undo and "My mix" (ticket IX06). The mixer itself (SN07) is tested in Symphony.test.tsx.

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { AnnouncerProvider } from '../../components'
import { resetUndo } from '../../interaction/history'
import { resetActionHandlers } from '../../interaction/registry'
import { expectNoA11yViolations } from '../../test/a11y'
import { installFakeAudioContext } from '../../test/fakes'
import { MIXER_NOTE_SECONDS } from './useMixerKeys'
import { MY_MIX_KEY } from './mySoundMix'
import { createFakeEnsemble, createFakeSource, withV3, type FakeEnsemble, type FakeSource } from './symphonyTestSupport'
import PlayerPage from '.'

const fakes = vi.hoisted(() => ({ ensemble: null as FakeEnsemble | null, source: null as FakeSource | null }))

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
vi.mock('../../analysis/video/useLiveSource', () => ({
  useLiveSource: (options: Parameters<FakeSource['useLiveSource']>[0]) => fakes.source!.useLiveSource(options),
}))

const v3 = withV3(fixture as Visualization)
const live = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''

let e: FakeEnsemble
let audio: ReturnType<typeof installFakeAudioContext>

beforeEach(() => {
  localStorage.clear()
  resetUndo()
  resetActionHandlers()
  e = createFakeEnsemble()
  fakes.ensemble = e
  fakes.source = createFakeSource()
  audio = installFakeAudioContext()
})
afterEach(() => audio.uninstall())

/** Mounted, with focus on Play inside the Symphony panel (so keys reach it) and the sound on or off. */
async function mount(soundOn = true) {
  const user = userEvent.setup()
  const view = render(<PlayerPage visualization={v3} />, { wrapper: AnnouncerProvider })
  if (soundOn) await act(async () => { await e.ensemble.start() })
  screen.getByRole('button', { name: soundOn ? 'Pause' : 'Play' }).focus()
  return { user, ...view }
}
const row = (voice: string) => screen.getByText(new RegExp(`^${voice}: `))

describe('Mixer keys', () => {
  it('soloes a voice on its number, and writes its state in the mixer list', async () => {
    const { user } = await mount()
    expect(row('melody')).toHaveTextContent('melody: on')
    await user.keyboard('1')
    expect(e.ensemble.solo).toHaveBeenLastCalledWith('melody')
    expect(row('melody')).toHaveTextContent('melody: solo')
    expect(row('harmony')).toHaveTextContent('harmony: silent while another voice is solo')
    expect(screen.getByRole('button', { name: 'Solo melody' })).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('1')
    expect(e.ensemble.solo).toHaveBeenLastCalledWith(null)
    expect(row('melody')).toHaveTextContent('melody: on')
  })

  it('mutes a voice on Shift and its number, by the key and not the character Shift makes', async () => {
    const { user } = await mount()
    await user.keyboard('{Shift>}2{/Shift}')
    expect(e.ensemble.mute).toHaveBeenLastCalledWith('harmony', true)
    expect(row('harmony')).toHaveTextContent('harmony: muted')
    expect(screen.getByRole('button', { name: 'Mute harmony' })).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('{Shift>}2{/Shift}')
    expect(e.ensemble.mute).toHaveBeenLastCalledWith('harmony', false)
  })

  it('plays one short melody note for a change, and a fifth lower for a mute', async () => {
    const { user } = await mount()
    await user.keyboard('1')
    await user.keyboard('{Shift>}1{/Shift}')
    expect(e.ensemble.playNotes).toHaveBeenCalledTimes(2)
    const [solo, mute] = e.ensemble.playNotes.mock.calls.map(call => call[0] as Array<{ midi: number; seconds: number }>)
    expect(solo).toHaveLength(1)
    expect(solo[0].seconds).toBe(MIXER_NOTE_SECONDS)
    expect(mute[0].midi).toBe(solo[0].midi - 7)
  })

  it('makes no sound while the sound is off, and still changes the mix', async () => {
    const { user } = await mount(false)
    await user.keyboard('1')
    expect(e.ensemble.solo).toHaveBeenLastCalledWith('melody')
    expect(e.ensemble.playNotes).not.toHaveBeenCalled()
  })

  it('changes nothing for a voice that this level of detail does not have, and says so', async () => {
    const { user } = await mount()
    await user.click(screen.getByRole('radio', { name: 'Calm' }))
    e.ensemble.mute.mockClear()
    await user.keyboard('{Shift>}4{/Shift}')
    expect(e.ensemble.mute).not.toHaveBeenCalled()
    expect(live()).toBe('Hot spots is not in this level of detail.')
  })

  it('puts the last change back on Ctrl+Z, one change at a time', async () => {
    const { user } = await mount()
    await user.keyboard('1')
    await user.keyboard('{Shift>}3{/Shift}')
    expect(row('bass')).toHaveTextContent('bass: muted')
    e.ensemble.mute.mockClear()
    await user.keyboard('{Control>}z{/Control}')
    expect(e.ensemble.mute).toHaveBeenCalledWith('bass', false)
    expect(row('bass')).toHaveTextContent('bass: silent while another voice is solo')
    expect(row('melody')).toHaveTextContent('melody: solo')
    await user.keyboard('{Control>}z{/Control}')
    expect(e.ensemble.solo).toHaveBeenLastCalledWith(null)
    expect(row('melody')).toHaveTextContent('melody: on')
    await user.keyboard('{Control>}z{/Control}')
    expect(live()).toBe('Nothing to undo.')
  })
})

describe('My mix', () => {
  it('saves the mutes and the solo on this device, and recalls them after a reset', async () => {
    const { user } = await mount()
    expect(screen.getByRole('button', { name: 'Recall my mix' })).toBeDisabled()
    await user.keyboard('{Shift>}2{/Shift}')
    await user.keyboard('{Shift>}3{/Shift}')
    await user.keyboard('1')
    await user.click(screen.getByRole('button', { name: 'Save my mix' }))
    expect(live()).toBe('My mix saved.')
    expect(JSON.parse(localStorage.getItem(MY_MIX_KEY) ?? '')).toEqual({ muted: ['harmony', 'bass'], solo: 'melody' })

    await user.click(screen.getByRole('button', { name: 'Reset the mix' }))
    expect(live()).toBe('The mix is reset. Every voice is on.')
    expect(row('melody')).toHaveTextContent('melody: on')
    expect(row('harmony')).toHaveTextContent('harmony: on')
    expect(e.ensemble.solo).toHaveBeenLastCalledWith(null)

    await user.click(screen.getByRole('button', { name: 'Recall my mix' }))
    expect(live()).toBe('My mix recalled.')
    expect(row('melody')).toHaveTextContent('melody: solo')
    expect(e.ensemble.mute).toHaveBeenCalledWith('harmony', true)
    expect(e.ensemble.mute).toHaveBeenCalledWith('bass', true)
    expect(e.ensemble.solo).toHaveBeenLastCalledWith('melody')
  })

  it('can be undone, whether it was recalled or reset', async () => {
    const { user } = await mount()
    await user.keyboard('{Shift>}2{/Shift}')
    await user.click(screen.getByRole('button', { name: 'Save my mix' }))
    await user.click(screen.getByRole('button', { name: 'Reset the mix' }))
    expect(row('harmony')).toHaveTextContent('harmony: on')
    await user.keyboard('{Control>}z{/Control}')
    expect(row('harmony')).toHaveTextContent('harmony: muted')
  })

  it('drops a voice that the ensemble does not have, and ignores a store that is broken', async () => {
    localStorage.setItem(MY_MIX_KEY, JSON.stringify({ muted: ['kazoo', 'bass'], solo: 'kazoo' }))
    const { user, unmount } = await mount()
    await user.click(screen.getByRole('button', { name: 'Recall my mix' }))
    expect(row('bass')).toHaveTextContent('bass: muted')
    expect(row('melody')).toHaveTextContent('melody: on')
    expect(e.ensemble.mute).not.toHaveBeenCalledWith('kazoo', expect.anything())
    unmount()

    localStorage.setItem(MY_MIX_KEY, '{broken')
    e = createFakeEnsemble()
    fakes.ensemble = e
    await mount()
    expect(screen.getByRole('button', { name: 'Recall my mix' })).toBeDisabled()
  })

  it('says so when the device will not keep the mix', async () => {
    const { user } = await mount()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    await user.click(screen.getByRole('button', { name: 'Save my mix' }))
    expect(live()).toBe('My mix could not be saved on this device.')
    vi.restoreAllMocks()
  })
})

describe('Mixer: accessibility', () => {
  it('has no violations with the mixer list and My mix', async () => {
    const { user, container } = await mount()
    await user.keyboard('1')
    await expectNoA11yViolations(container)
  })
})
