import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { AnnouncerProvider } from '../../components'
import type { Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import type { RenderOutput } from '../playlist/renderSequence'
import { ArtPanel } from './ArtPanel'
import { ART_LABEL, MAX_SAVED, type ArtPreset } from './presets'
import { presetFileText } from './schema'
import { ART_PRESETS_KEY } from './store'
import { useArt, type ArtDeps } from './useArt'

const visualization = fixture as Visualization
/** Text shown in the panel itself (the same sentence is also in the live region). */
const inPanel = () => within(screen.getByRole('region', { name: ART_LABEL }))
const live = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''

const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL
let seen: ReturnType<typeof useArt> | null = null

function Harness({ deps }: { deps?: ArtDeps }) {
  const art = useArt(visualization, deps)
  useEffect(() => { seen = art })
  return <ArtPanel art={art} />
}

function mount(deps?: ArtDeps) {
  const user = userEvent.setup()
  return { user, ...render(<Harness deps={deps} />, { wrapper: AnnouncerProvider }) }
}

const turnOn = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Art mode' }))
const type = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const box = screen.getByRole('textbox', { name: 'Preset name' })
  await user.clear(box)
  await user.type(box, name)
}

beforeEach(() => {
  localStorage.clear()
  seen = null
  let counter = 0
  URL.createObjectURL = () => `blob:art/${counter++}`
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
})

describe('ArtPanel: the label', () => {
  it('shows the label as the heading and the first line', () => {
    mount()
    expect(screen.getByRole('heading', { name: ART_LABEL })).toBeInTheDocument()
    expect(screen.getAllByText(ART_LABEL)).toHaveLength(2)
    expect(ART_LABEL).toBe("Art mode: the sound choices are yours; the data mapping doesn't change.")
  })

  it('is also the panel\'s accessible description', () => {
    mount()
    expect(screen.getByRole('region', { name: ART_LABEL })).toHaveAccessibleDescription(ART_LABEL)
  })

  it('has no accessibility violations, off or on', async () => {
    const { container, user } = mount()
    await expectNoA11yViolations(container)
    await turnOn(user)
    await expectNoA11yViolations(container)
  })
})

describe('ArtPanel: the controls', () => {
  it('is off at first: no sliders, and no preset is played', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Art mode', pressed: false })).toBeInTheDocument()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(seen?.preset).toBeNull()
  })

  it('gives every control a name', async () => {
    const { user } = mount()
    await turnOn(user)
    for (const name of ['Key', 'Tempo', 'Brightness']) expect(screen.getByRole('slider', { name })).toBeInTheDocument()
    for (const name of ['Major', 'Dorian', 'Minor pentatonic', 'Save preset', 'Export preset', 'Record this art']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Preset name' })).toBeInTheDocument()
    expect(screen.getByLabelText('Import a preset file')).toBeInTheDocument()
    for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('slider'), ...screen.getAllByRole('textbox')]) {
      expect(control).toHaveAccessibleName()
    }
  })

  it('has no control that maps a picture feature to a voice: sliders and buttons for the four choices only', async () => {
    const { user } = mount()
    await turnOn(user)
    expect(screen.getAllByRole('slider').map(slider => slider.getAttribute('aria-valuetext')?.length).every(Boolean)).toBe(true)
    expect(screen.getAllByRole('slider')).toHaveLength(3)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('plays a preset with the chosen key, scale, tempo and brightness, and says it in words', async () => {
    const { user } = mount()
    await turnOn(user)
    fireEvent.change(screen.getByRole('slider', { name: 'Key' }), { target: { value: '7' } })
    await user.click(screen.getByRole('button', { name: 'Minor pentatonic' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '110' } })
    fireEvent.change(screen.getByRole('slider', { name: 'Brightness' }), { target: { value: '25' } })
    expect(seen?.preset).toMatchObject({ tonic: 7, scale: 'minorPentatonic', bpm: 110, brightness: 0.25 })
    expect(screen.getByRole('slider', { name: 'Key' })).toHaveAttribute('aria-valuetext', 'G')
    expect(screen.getByText('G minor pentatonic, 110 beats a minute, brightness 25 percent.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Minor pentatonic', pressed: true })).toBeInTheDocument()
  })

  it('keeps the same preset object while only the name is typed, so the sound is not restarted', async () => {
    const { user } = mount()
    await turnOn(user)
    const before = seen?.preset
    await type(user, 'Dusk')
    expect(seen?.preset).toBe(before)
  })

  it('goes back to the default, and forgets the unsaved choice, when art mode is turned off', async () => {
    const { user } = mount()
    await turnOn(user)
    await user.click(screen.getByRole('button', { name: 'Dorian' }))
    expect(seen?.preset?.scale).toBe('dorian')
    await user.click(screen.getByRole('button', { name: 'Art mode' }))
    expect(seen?.preset).toBeNull()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(live()).toContain('Art mode is off')
    expect(localStorage.getItem(ART_PRESETS_KEY)).toBeNull()
    await turnOn(user)
    expect(seen?.choice.scale).toBe('major')
  })
})

describe('ArtPanel: saved presets', () => {
  it('saves under a name, loads, renames and deletes, and keeps them on this device', async () => {
    const { user } = mount()
    await turnOn(user)
    await user.click(screen.getByRole('button', { name: 'Save preset' }))
    expect(inPanel().getByText('Give the preset a name first.')).toBeInTheDocument()

    await type(user, 'Dusk')
    await user.click(screen.getByRole('button', { name: 'Dorian' }))
    await user.click(screen.getByRole('button', { name: 'Save preset' }))
    expect(live()).toBe('Saved the preset Dusk.')
    const list = screen.getByRole('list', { name: 'Saved presets' })
    expect(within(list).getByText(/Dusk: .*dorian/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(ART_PRESETS_KEY) ?? '[]')).toEqual([{ name: 'Dusk', tonic: 0, scale: 'dorian', bpm: 84, brightness: 0.5 }])

    await user.click(screen.getByRole('button', { name: 'Major' }))
    await user.click(screen.getByRole('button', { name: 'Load Dusk' }))
    expect(screen.getByRole('button', { name: 'Dorian', pressed: true })).toBeInTheDocument()
    expect(live()).toBe('Loaded the preset Dusk.')

    await type(user, 'Dawn')
    await user.click(screen.getByRole('button', { name: 'Rename Dusk to the name above' }))
    expect(live()).toBe('Renamed Dusk to Dawn.')
    expect(screen.getByRole('button', { name: 'Load Dawn' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Dawn' }))
    expect(live()).toBe('Deleted the preset Dawn.')
    expect(screen.queryByRole('list', { name: 'Saved presets' })).toBeNull()
    expect(JSON.parse(localStorage.getItem(ART_PRESETS_KEY) ?? 'null')).toEqual([])
  })

  it('lists the presets already saved, and plays one when it is loaded with art mode off', async () => {
    const stored: ArtPreset = { name: 'Old', tonic: 4, scale: 'major', bpm: 65, brightness: 0.1 }
    localStorage.setItem(ART_PRESETS_KEY, JSON.stringify([stored]))
    const { user } = mount()
    await turnOn(user)
    await user.click(screen.getByRole('button', { name: 'Load Old' }))
    expect(seen?.preset).toMatchObject({ tonic: 4, bpm: 65, brightness: 0.1 })
  })

  it('ignores a corrupt stored list', async () => {
    localStorage.setItem(ART_PRESETS_KEY, '{ broken')
    const { user } = mount()
    await turnOn(user)
    expect(screen.queryByRole('list', { name: 'Saved presets' })).toBeNull()
  })

  it('refuses an eleventh preset in words', async () => {
    const full = Array.from({ length: MAX_SAVED }, (_, i): ArtPreset => ({ name: `P${i}`, tonic: 0, scale: 'major', bpm: 84, brightness: 0.5 }))
    localStorage.setItem(ART_PRESETS_KEY, JSON.stringify(full))
    const { user } = mount()
    await turnOn(user)
    await type(user, 'Eleventh')
    await user.click(screen.getByRole('button', { name: 'Save preset' }))
    expect(inPanel().getByText('You can keep 10 presets. Delete one to save another.')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(ART_PRESETS_KEY) ?? '[]')).toHaveLength(MAX_SAVED)
  })
})

describe('ArtPanel: export and import', () => {
  const file = (body: string, name = 'x.preset.json') => new File([body], name, { type: 'application/json' })

  it('exports a preset as a downloadable .preset.json file', async () => {
    const { user } = mount()
    await turnOn(user)
    await type(user, 'My Dusk')
    await user.click(screen.getByRole('button', { name: 'Dorian' }))
    await user.click(screen.getByRole('button', { name: 'Export preset' }))
    const link = screen.getByRole('link', { name: 'Download the preset My Dusk as a file' })
    expect(link).toHaveAttribute('download', 'my-dusk.preset.json')
    expect(link).toHaveAttribute('href', expect.stringMatching(/^blob:/))
    expect(live()).toBe('The preset My Dusk is ready to download.')
  })

  it('imports a valid file: the choice is applied and art mode is on', async () => {
    const { user } = mount()
    await user.click(screen.getByRole('button', { name: 'Art mode' }))
    await user.upload(screen.getByLabelText('Import a preset file'), file(JSON.stringify({ name: 'Brought', tonic: 5, scale: 'dorian', bpm: 99, brightness: 0.8 })))
    await waitFor(() => expect(live()).toBe('Loaded the preset Brought from the file.'))
    expect(seen?.preset).toMatchObject({ tonic: 5, scale: 'dorian', bpm: 99, brightness: 0.8 })
    expect(screen.getByRole('textbox', { name: 'Preset name' })).toHaveValue('Brought')
  })

  it.each([
    ['is not JSON', 'nonsense'],
    ['has a field art mode does not have', JSON.stringify({ name: 'X', tonic: 0, scale: 'major', bpm: 80, brightness: 0.5, instrument: 'piano' })],
    ['has a bad type', JSON.stringify({ name: 'X', tonic: 'C', scale: 'major', bpm: 80, brightness: 0.5 })],
  ])('refuses a file that %s, in words, and changes nothing', async (_name, body) => {
    const { user } = mount()
    await turnOn(user)
    await user.click(screen.getByRole('button', { name: 'Dorian' }))
    const before = seen?.preset
    await user.upload(screen.getByLabelText('Import a preset file'), file(body))
    await waitFor(() => expect(live()).toMatch(/^That file is not a preset.* Nothing was changed\.$/))
    expect(seen?.preset).toBe(before)
    expect(screen.getByRole('textbox', { name: 'Preset name' })).toHaveValue('')
  })

  it('gives the same preset after an export and an import', async () => {
    const { user } = mount()
    await turnOn(user)
    await type(user, 'Round')
    await user.click(screen.getByRole('button', { name: 'Minor pentatonic' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Key' }), { target: { value: '3' } })
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '70' } })
    const choice = { tonic: 3, scale: 'minorPentatonic', bpm: 70, brightness: 0.5 } as const
    expect(seen?.choice).toEqual(choice)
    // What Export writes is what Import reads (jsdom's Blob cannot be read back, so the file text is made by the module the button uses).
    const exported = presetFileText({ name: 'Round', ...choice })
    await user.click(screen.getByRole('button', { name: 'Art mode' }))
    expect(seen?.preset).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Art mode' }))
    await user.upload(screen.getByLabelText('Import a preset file'), file(exported))
    await waitFor(() => expect(seen?.choice).toEqual(choice))
    expect(seen?.name).toBe('Round')
  })
})

describe('ArtPanel: record this art', () => {
  const output: RenderOutput = { id: 'fixture', title: 'Fixture', wav: new Blob(['wav']), vtt: '', sidecar: '', seconds: 3 }

  it('renders with the art preset, shows its status, and offers the WAV named for the preset and the data set', async () => {
    let finish: (value: RenderOutput) => void = () => {}
    const render = vi.fn(() => new Promise<RenderOutput>(resolve => { finish = resolve }))
    const { user } = mount({ render })
    await turnOn(user)
    await type(user, 'Dusk')
    await user.click(screen.getByRole('button', { name: 'Dorian' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '70' } })
    await user.click(screen.getByRole('button', { name: 'Record this art' }))

    expect(render).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledWith(visualization, { preset: expect.objectContaining({ label: 'Dusk', scale: 'dorian', bpm: 70, tonic: 0, brightness: 0.5 }) })
    expect(inPanel().getByText('Recording this art. This can take a little while.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record this art' })).toBeDisabled()

    finish(output)
    const link = await screen.findByRole('link', { name: 'Download the recording of Dusk as a WAV file' })
    expect(link).toHaveAttribute('download', `dusk-${visualization.id}.wav`)
    expect(link).toHaveAttribute('href', expect.stringMatching(/^blob:/))
    expect(inPanel().getByText('The recording of Dusk is ready to download.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record this art' })).toBeEnabled()
  })

  it('says so in words when the recording fails, and can be tried again', async () => {
    const render = vi.fn().mockRejectedValueOnce(new Error('No sound card.')).mockResolvedValueOnce(output)
    const { user } = mount({ render })
    await turnOn(user)
    await user.click(screen.getByRole('button', { name: 'Record this art' }))
    expect(await inPanel().findByText('The recording could not be made. No sound card.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Record this art' }))
    expect(await screen.findByRole('link', { name: /Download the recording of Art mode/ })).toBeInTheDocument()
  })
})
