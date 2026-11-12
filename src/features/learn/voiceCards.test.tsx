import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixtureManifest from '../../../public/data/fixture/manifest.json'
import { extractFeatures } from '../../analysis/features/extract'
import { decodePng } from '../../analysis/png'
import { AnnouncerProvider } from '../../components'
import { VOICE_IDS, type Visualization } from '../../data'
import { visualizationSchema } from '../../data/schema'
import { presetFor, toMusicFrame } from '../../sonify'
import { expectNoA11yViolations } from '../../test/a11y'
import { VOICE_CARDS, VOICE_TEACHING } from './voiceCards'
import { VoiceCards } from './VoiceCardsSection'

const visualization = fixtureManifest as Visualization

// The ensemble and the frame source are faked: the cards' job is to call them in the right order.
const calls = vi.hoisted(() => [] as string[])
const ensemble = vi.hoisted(() => ({
  start: vi.fn(async () => { calls.push('start') }),
  stop: vi.fn(() => { calls.push('stop') }),
  solo: vi.fn((voice: string | null) => { calls.push(`solo:${voice}`) }),
  apply: vi.fn(),
  setDetail: vi.fn(),
  dispose: vi.fn(),
}))
const source = vi.hoisted(() => ({ start: vi.fn(() => { calls.push('source.start') }), dispose: vi.fn() }))
const options = vi.hoisted(() => ({ current: null as null | { step?: string; onStatus: (status: string, reason?: string) => void } }))
vi.mock('../../audio/ensemble/useEnsemble', () => ({ useEnsemble: () => ({ ensemble, status: 'off', start: ensemble.start }) }))
vi.mock('../../analysis/video/frameSequence', () => ({
  FrameSequenceSource: class {
    constructor(o: { step?: string; onStatus: (status: string, reason?: string) => void }) { options.current = o }
    start = source.start
    dispose = source.dispose
  },
}))

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
})

const show = (v: Visualization = visualization) => render(<VoiceCards visualization={v} />, { wrapper: AnnouncerProvider })

describe('the voice cards text', () => {
  it('has one entry for each voice, in the order of the voices', () => {
    expect(VOICE_CARDS.map(card => card.id)).toEqual([...VOICE_IDS])
    expect(Object.keys(VOICE_TEACHING)).toEqual([...VOICE_IDS])
  })

  it('names no data set, unit or date', () => {
    const text = VOICE_CARDS.map(card => `${card.name} ${card.means} ${card.listen}`).join(' ').toLowerCase()
    for (const word of ['warm', 'cold', 'temperature', 'celsius', 'degree', 'ocean', 'sea ', 'january', 'february', 'march', '°']) expect(text).not.toContain(word)
    expect(text).not.toMatch(/\d/)
  })
})

describe('Seven voices', () => {
  it('shows seven labelled cards and the data set it plays on, and makes no sound on render', () => {
    show()
    expect(screen.getByRole('heading', { name: 'Seven voices' })).toBeInTheDocument()
    expect(screen.getByText(`Played on: ${visualization.title}.`)).toBeInTheDocument()
    for (const { name } of VOICE_CARDS) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Play ${name.toLowerCase()} alone` })).toBeEnabled()
    }
    expect(calls).toEqual([])
  })

  it('starts the ensemble, solos the voice, then starts the source at the slow step', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Play melody alone' }))
    await waitFor(() => expect(source.start).toHaveBeenCalled())
    expect(calls.slice(-3)).toEqual(['start', 'solo:melody', 'source.start'])
    expect(options.current?.step).toBe('slow')
    expect(within(screen.getByRole('region', { name: 'Melody' })).getByText('Playing melody alone.')).toBeInTheDocument()
  })

  it('disables the other cards while one plays, and Stop releases the solo so the others come back', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Play bass alone' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop bass' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Play melody alone' })).toBeDisabled()
    calls.length = 0
    await userEvent.click(screen.getByRole('button', { name: 'Stop bass' }))
    expect(calls).toEqual(['solo:null', 'stop'])
    expect(source.dispose).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play melody alone' })).toBeEnabled()
    expect(within(screen.getByRole('region', { name: 'Bass' })).queryByText('Playing bass alone.')).not.toBeInTheDocument()
  })

  it('says so when the frames cannot be read, and lets the other cards play again', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Play rhythm alone' }))
    await waitFor(() => expect(source.start).toHaveBeenCalled())
    options.current?.onStatus('error', 'No picture.')
    expect(await screen.findByText(/No picture\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play rhythm alone' })).toBeEnabled()
  })

  it('shows a sentence and no button for a voice the data set does not use', () => {
    show({ ...visualization, sonification: { preset: 'major', voices: ['melody', 'time'] } })
    expect(screen.getByRole('button', { name: 'Play melody alone' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play bass alone' })).not.toBeInTheDocument()
    expect(screen.getAllByText('This data set does not use this voice.')).toHaveLength(5)
  })

  it('announces the start', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Play harmony alone' }))
    await waitFor(() => expect(source.start).toHaveBeenCalled())
    expect(screen.getAllByText('Playing harmony alone.').length).toBeGreaterThanOrEqual(1)
  })

  it('has no accessibility violations', async () => {
    const { container } = show()
    await expectNoA11yViolations(container)
  })
})

describe('golden: the card texts and the first music frame of the fixture', () => {
  it('matches the committed file', async () => {
    const dir = resolve(fileURLToPath(import.meta.url), '../../../../public/data/fixture')
    const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')))
    const first = [...v.frames].sort((a, b) => a.date.localeCompare(b.date))[0]
    const features = extractFeatures(decodePng(readFileSync(`${dir}/${first.image}`)), {
      frameId: `fixture/${first.id}`, date: first.date, mode: 'data', colorScale: v.colorScale, mapping: v.mapping, area: v.mapArea ?? { x0: 0, y0: 0, x1: 1, y1: 1 },
      baseline: undefined,
    })
    const frame = toMusicFrame(features, presetFor(v.sonification?.preset ?? 'major'))
    const text = JSON.stringify({
      texts: VOICE_TEACHING,
      firstFrame: { frameId: frame.frameId, solo: Object.fromEntries(VOICE_IDS.map(id => [id, frame.caption[id]])), summary: frame.summary },
    }, null, 2) + '\n'
    await expect(text).toMatchFileSnapshot('__golden__/voice-cards.json')
  })
})
