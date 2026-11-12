import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as speech from '../welcome/speak'
import { AnnouncerContext } from '../../components/announcerContext'
import { expectNoA11yViolations } from '../../test/a11y'
import { JukeboxPlayer } from './JukeboxPlayer'
import { midiToFrequency, type AudioPayload, type Step, type VisionPayload } from './payload'

// A stand-in for Tone that records what was built and played. Nothing fires until a test fires it.
const tone = vi.hoisted(() => {
  type Callback = (time: number, value: unknown) => void
  const state = {
    startError: null as Error | null,
    started: 0,
    synths: [] as { kind: string; options: unknown; volume: { setValueAtTime: ReturnType<typeof vi.fn> }; triggerAttackRelease: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; connectedTo: unknown }[],
    sequences: [] as { callback: Callback; events: unknown[]; subdivision: unknown; loop: boolean; startedAt: unknown; dispose: ReturnType<typeof vi.fn> }[],
    limiters: [] as { threshold: number; toDestinationCalled: boolean; dispose: ReturnType<typeof vi.fn> }[],
    transport: {
      state: 'stopped',
      position: -1 as unknown,
      bpm: { value: 0 },
      once: [] as { id: number; callback: (time: number) => void; time: number }[],
      cleared: [] as number[],
      start() { this.state = 'started' },
      stop() { this.state = 'stopped' },
      scheduleOnce(callback: (time: number) => void, time: number) { const id = this.once.length + 1; this.once.push({ id, callback, time }); return id },
      clear(id: number) { this.cleared.push(id) },
    },
  }
  class Limiter {
    threshold: number
    toDestinationCalled = false
    dispose = vi.fn()
    constructor(threshold: number) { this.threshold = threshold; state.limiters.push(this) }
    toDestination() { this.toDestinationCalled = true; return this }
  }
  class Synth {
    volume = { setValueAtTime: vi.fn() }
    triggerAttackRelease = vi.fn()
    dispose = vi.fn()
    connectedTo: unknown = null
    kind = 'Synth'
    options: unknown
    constructor(options?: unknown) { this.options = options; state.synths.push(this) }
    connect(target: unknown) { this.connectedTo = target; return this }
  }
  class AMSynth extends Synth {
    kind = 'AMSynth'
  }
  class Sequence {
    loop = true
    startedAt: unknown = null
    dispose = vi.fn()
    callback: Callback
    events: unknown[]
    subdivision: unknown
    constructor(callback: Callback, events: unknown[], subdivision: unknown) {
      this.callback = callback
      this.events = events
      this.subdivision = subdivision
      state.sequences.push(this)
    }
    start(at: unknown) { this.startedAt = at; return this }
  }
  const module = {
    start: async () => { if (state.startError) throw state.startError; state.started += 1 },
    getTransport: () => state.transport,
    now: () => 1,
    gainToDb: (gain: number) => 20 * Math.log10(gain),
    Limiter,
    Synth,
    AMSynth,
    Sequence,
  }
  return { state, module }
})

vi.mock('tone', () => tone.module)

const one: AudioPayload = { base_bpm: 90, tracks: [{ instrument: 'marimba', pitch_range: [48, 72], volume_curve: [0.2, 0, 0.8] }] }
const two: AudioPayload = {
  base_bpm: 120,
  tracks: [
    { instrument: 'marimba', pitch_range: [60, 72], volume_curve: [0.5, 1] },
    { instrument: 'bass', pitch_range: [36, 43], volume_curve: [1, 0.5, 1, 0.5] },
  ],
}

let announced: string[]
let spoke: string[]

function show(payload: AudioPayload, vision?: VisionPayload) {
  const wrap = (p: AudioPayload) => (
    <AnnouncerContext.Provider value={text => announced.push(text)}>
      <JukeboxPlayer payload={p} vision={vision} />
    </AnnouncerContext.Provider>
  )
  const view = render(wrap(payload))
  return { ...view, change: (next: AudioPayload) => view.rerender(wrap(next)) }
}

const pressPlay = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Play' }))
  await screen.findByRole('button', { name: 'Stop' })
  await waitFor(() => expect(tone.state.transport.state).toBe('started'))
}

beforeEach(() => {
  announced = []
  spoke = []
  vi.spyOn(speech, 'speak').mockImplementation(async text => { spoke.push(text) })
  vi.spyOn(speech, 'hush').mockImplementation(() => { spoke.push('<hush>') })
  vi.stubGlobal('speechSynthesis', {})
  vi.stubGlobal('SpeechSynthesisUtterance', class {})
  const { state } = tone
  state.startError = null
  state.started = 0
  state.synths = []
  state.sequences = []
  state.limiters = []
  Object.assign(state.transport, { state: 'stopped', position: -1, once: [], cleared: [] })
  state.transport.bpm.value = 0
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('JukeboxPlayer', () => {
  it('builds and plays nothing until Play is pressed, and says in words what it will play', async () => {
    const { container } = show(two)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByText('2 tracks at 120 beats a minute, about 1 second.')).toBeInTheDocument()
    expect(screen.getByText('bass: MIDI notes 36 to 43, 4 steps')).toBeInTheDocument()
    expect(tone.state.started).toBe(0)
    expect(tone.state.synths).toHaveLength(0)
    expect(tone.state.transport.state).toBe('stopped')
    await expectNoA11yViolations(container)
  })

  it('on Play sets the tempo, builds one synth and one sequence for each track behind a limiter, and starts from the beginning', async () => {
    const { container } = show(two)
    await pressPlay()
    const { synths, sequences, limiters, transport } = tone.state
    expect(tone.state.started).toBe(1)
    expect(transport.bpm.value).toBe(120)
    expect(transport.position).toBe(0)
    expect(limiters).toHaveLength(1)
    expect(limiters[0].threshold).toBe(-1)
    expect(limiters[0].toDestinationCalled).toBe(true)
    expect(synths).toHaveLength(2)
    expect(synths.every(synth => synth.connectedTo === limiters[0])).toBe(true)
    expect(sequences).toHaveLength(2)
    expect(sequences.map(s => [s.subdivision, s.loop, s.startedAt])).toEqual([['8n', false, 0], ['8n', false, 0]])
    expect(sequences[1].events).toHaveLength(4)
    expect(announced).toEqual(['Playing'])
    await expectNoA11yViolations(container)
  })

  it('a step sets the volume from the curve and plays the note from the pitch range; a 0 is a rest', async () => {
    show(one)
    await pressPlay()
    const [synth] = tone.state.synths
    const [sequence] = tone.state.sequences
    expect(sequence.events).toEqual([{ frequency: midiToFrequency(48), gain: 0.2 }, null, { frequency: midiToFrequency(72), gain: 0.8 }])

    sequence.callback(1.5, sequence.events[2] as Step)
    expect(synth.volume.setValueAtTime).toHaveBeenCalledWith(20 * Math.log10(0.8), 1.5)
    expect(synth.triggerAttackRelease).toHaveBeenCalledWith(midiToFrequency(72), expect.closeTo(0.3), 1.5)

    sequence.callback(2, null)
    expect(synth.triggerAttackRelease).toHaveBeenCalledTimes(1)
  })

  it('shares the level between the tracks', async () => {
    show(two)
    await pressPlay()
    tone.state.sequences[1].callback(0, tone.state.sequences[1].events[0])
    expect(tone.state.synths[1].volume.setValueAtTime).toHaveBeenCalledWith(20 * Math.log10(0.5), 0)
  })

  it('Stop silences everything, removes it, and the button reads Play again', async () => {
    show(two)
    await pressPlay()
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const { synths, sequences, limiters, transport } = tone.state
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(transport.state).toBe('stopped')
    expect(transport.cleared).toEqual([transport.once[0].id])
    for (const node of [...synths, ...sequences, ...limiters]) expect(node.dispose).toHaveBeenCalledTimes(1)
    expect(announced).toEqual(['Playing', 'Stopped'])
  })

  it('stops by itself one step after the longest track ends', async () => {
    show(two)
    await pressPlay()
    const [end] = tone.state.transport.once
    expect(end.time).toBe(4 * 0.25 + 0.25)
    end.callback(1.05) // The Transport calls 50 ms early.
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(tone.state.transport.state).toBe('stopped')
    expect(tone.state.synths[0].dispose).toHaveBeenCalledTimes(1)
    expect(announced).toEqual(['Playing', 'Finished'])
  })

  it('plays again after it has stopped', async () => {
    show(one)
    await pressPlay()
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await pressPlay()
    expect(tone.state.synths).toHaveLength(2)
    expect(tone.state.synths[1].dispose).not.toHaveBeenCalled()
  })

  it('stops the old sound when the payload changes or the player leaves the page', async () => {
    const view = show(one)
    await pressPlay()
    view.change(two)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(tone.state.synths[0].dispose).toHaveBeenCalledTimes(1)

    await pressPlay()
    view.unmount()
    expect(tone.state.transport.state).toBe('stopped')
    expect(tone.state.synths.every(synth => synth.dispose.mock.calls.length === 1)).toBe(true)
  })

  it('says so when the sound cannot start, and plays nothing', async () => {
    tone.state.startError = new Error('no audio')
    show(one)
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The sound could not start. Try again.')
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(tone.state.synths).toHaveLength(0)
  })
})

describe('the end of playback', () => {
  it('does not fire after Stop', async () => {
    show(one)
    await pressPlay()
    tone.state.transport.once[0].callback(1.05)
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await new Promise(resolve => setTimeout(resolve, 120))
    expect(announced).toEqual(['Playing', 'Stopped'])
  })
})

const vision: VisionPayload = {
  descriptions: [
    { timestamp_sec: 1, alt_text: 'Pale water.', intensity_level: 'low' },
    { timestamp_sec: 0, alt_text: 'Open sea.', intensity_level: 'medium' },
  ],
}

describe('captions', () => {
  it('shows nothing about captions, and schedules only the end, without vision', async () => {
    show(two)
    expect(screen.queryByText(/Descriptions appear here/)).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await pressPlay()
    expect(tone.state.transport.once).toHaveLength(1)
  })

  it('schedules each description at its time, and at that time shows, announces and (only if on) speaks it', async () => {
    const { container } = show(two, vision)
    expect(screen.getByText('Descriptions appear here while it plays.')).toBeInTheDocument()
    await pressPlay()
    const [, first, second] = tone.state.transport.once
    expect([first.time, second.time]).toEqual([0, 0.75]) // 1 s is later than the last step (0.75 s), so it is moved there

    first.callback(1)
    expect(await screen.findByText('Open sea.')).toBeInTheDocument()
    expect(screen.getByText('medium intensity')).toBeInTheDocument()
    expect(announced).toContain('Open sea.')
    expect(spoke).toEqual([])
    await expectNoA11yViolations(container)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Spoken narration (Web Speech API)' }))
    second.callback(1)
    expect(await screen.findByText('Pale water.')).toBeInTheDocument()
    expect(spoke).toEqual(['Pale water.'])
  })

  it('has no speech toggle where the browser has no speech', () => {
    vi.unstubAllGlobals()
    show(two, vision)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('Stop clears the pending captions and the speech', async () => {
    show(two, vision)
    await pressPlay()
    const { transport } = tone.state
    transport.once[1].callback(10) // Due in 9 s, so Stop comes first.
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(transport.cleared).toEqual(expect.arrayContaining(transport.once.map(event => event.id)))
    expect(spoke).toContain('<hush>')
    expect(screen.getByText('Descriptions appear here while it plays.')).toBeInTheDocument()
    await new Promise(resolve => setTimeout(resolve, 60))
    expect(announced).not.toContain('Open sea.')
  })
})

describe('timbres', () => {
  const payload: AudioPayload = {
    base_bpm: 120,
    tracks: [
      { instrument: 'Sub Bass', pitch_range: [36, 48], volume_curve: [1] },
      { instrument: 'Ambient Pad', pitch_range: [60, 72], volume_curve: [1] },
      { instrument: 'marimba', pitch_range: [60, 72], volume_curve: [1] },
    ],
  }

  it('builds a triangle bass, an AM pad with a slow attack, and a sawtooth lead', async () => {
    show(payload)
    await pressPlay()
    const [bass, pad, lead] = tone.state.synths
    expect([bass.kind, bass.options]).toEqual(['Synth', { oscillator: { type: 'triangle' } }])
    expect([pad.kind, pad.options]).toEqual(['AMSynth', { envelope: { attack: 0.1 } }])
    expect([lead.kind, lead.options]).toEqual(['Synth', { oscillator: { type: 'sawtooth' } }])
  })

  it('plays the bass an octave lower', async () => {
    show(payload)
    await pressPlay()
    const [bass, , lead] = tone.state.synths
    const [bassSequence, , leadSequence] = tone.state.sequences
    bassSequence.callback(0, bassSequence.events[0] as Step)
    leadSequence.callback(0, leadSequence.events[0] as Step)
    expect(bass.triggerAttackRelease.mock.calls[0][0]).toBeCloseTo(midiToFrequency(42) / 2)
    expect(lead.triggerAttackRelease.mock.calls[0][0]).toBeCloseTo(midiToFrequency(66))
  })
})
