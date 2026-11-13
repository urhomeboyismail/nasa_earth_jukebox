// IX12: art mode on the Listen page. The chosen preset is what the Symphony plays, and the manifest's own preset returns when art mode is off.
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { AnnouncerProvider } from '../../components'
import type { Visualization } from '../../data'
import type { Preset } from '../../sonify/types'
import { expectNoA11yViolations } from '../../test/a11y'
import { installFakeAudioContext } from '../../test/fakes'
import { ART_LABEL } from '../art/presets'
import { createFakeEnsemble, createFakeSource, withV3, type FakeEnsemble, type FakeSource } from './symphonyTestSupport'
import PlayerPage from '.'

const fakes = vi.hoisted(() => ({ ensemble: null as FakeEnsemble | null, source: null as FakeSource | null, presets: [] as Preset[] }))

vi.mock('../../audio/ensemble/useEnsemble', async () => {
  const { useEffect, useSyncExternalStore } = await import('react')
  return {
    useEnsemble: (preset: Preset) => {
      fakes.presets.push(preset)
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
const lastPreset = () => fakes.presets[fakes.presets.length - 1]
let audio: ReturnType<typeof installFakeAudioContext>

beforeEach(() => {
  localStorage.clear()
  fakes.ensemble = createFakeEnsemble()
  fakes.source = createFakeSource()
  fakes.presets = []
  audio = installFakeAudioContext()
})
afterEach(() => audio.uninstall())

function mount() {
  const user = userEvent.setup()
  return { user, ...render(<PlayerPage visualization={v3} />, { wrapper: AnnouncerProvider }) }
}

describe('Listen page: art mode (IX12)', () => {
  it('shows the panel in Symphony mode, with its label, and plays the manifest\'s preset until art mode is on', () => {
    mount()
    expect(screen.getByRole('region', { name: ART_LABEL })).toBeInTheDocument()
    expect(lastPreset().id).toBe(v3.sonification?.preset ?? 'major')
    expect(lastPreset().label).not.toBe('Art mode')
  })

  it('plays the chosen key, scale, tempo and brightness in the Symphony, and no sound starts before Play', async () => {
    const { user } = mount()
    const original = lastPreset()
    await user.click(screen.getByRole('button', { name: 'Art mode' }))
    await user.click(screen.getByRole('button', { name: 'Minor pentatonic' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '115' } })
    expect(lastPreset()).toMatchObject({ id: original.id, scale: 'minorPentatonic', bpm: 115, tonic: original.tonic, brightness: original.brightness })
    expect(fakes.ensemble!.ensemble.start).not.toHaveBeenCalled()
    expect(audio.contexts).toHaveLength(0)
  })

  it('goes back to the manifest\'s preset when art mode is turned off', async () => {
    const { user } = mount()
    const original = lastPreset()
    await user.click(screen.getByRole('button', { name: 'Art mode' }))
    await user.click(screen.getByRole('button', { name: 'Dorian' }))
    expect(lastPreset()).not.toBe(original)
    await user.click(screen.getByRole('button', { name: 'Art mode' }))
    expect(lastPreset()).toBe(original)
  })

  it('is not on the Scan or Simple pages', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('radio', { name: 'Simple mode' }))
    expect(screen.queryByRole('region', { name: ART_LABEL })).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'Scan' }))
    expect(screen.queryByRole('region', { name: ART_LABEL })).toBeNull()
  })

  it('has no accessibility violations with art mode on', async () => {
    const { user, container } = mount()
    await user.click(screen.getByRole('button', { name: 'Art mode' }))
    await expectNoA11yViolations(container)
  })
})
