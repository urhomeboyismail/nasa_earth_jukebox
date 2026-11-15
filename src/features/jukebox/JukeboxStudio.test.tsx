import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnouncerContext } from '../../components/announcerContext'
import { expectNoA11yViolations } from '../../test/a11y'
import { JukeboxStudio } from './JukeboxStudio'

// The player has its own tests; here it is a marker that shows what it was given.
vi.mock('./JukeboxPlayer', () => ({
  JukeboxPlayer: ({ payload, vision }: { payload: { base_bpm: number }; vision?: { descriptions: unknown[] } | null }) => (
    <p>Player at {payload.base_bpm} with {vision ? vision.descriptions.length : 0} descriptions</p>
  ),
}))

// The pictures have their own tests (LiveImages.test.tsx); here a marker that shows what they were given.
vi.mock('./LiveImages', () => ({
  LiveImages: ({ pictures }: { pictures: { images: unknown[]; legend: { kind: string } } }) => (
    <p>{pictures.images.length} {pictures.legend.kind} pictures</p>
  ),
}))

// Echo's 3D robot needs WebGL; here it is a marker that shows its face and gesture.
vi.mock('../mascot/Ixia', () => ({
  default: ({ expression, pose }: { expression: string; pose: string }) => <p>Echo looks {expression} and is {pose}</p>,
}))

const audio = { base_bpm: 90, tracks: [{ instrument: 'marimba', pitch_range: [48, 72], volume_curve: [0.2, 0.8] }] }
const vision = { descriptions: [{ timestamp_sec: 0, alt_text: 'Pale water.', intensity_level: 'low' }] }
const good = { approved: true, feedback: '', revisions: 0, audio, vision }

let announced: string[]

function reply(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status })
}

function show() {
  return render(
    <AnnouncerContext.Provider value={text => announced.push(text)}>
      <JukeboxStudio />
    </AnnouncerContext.Provider>,
  )
}

beforeEach(() => {
  announced = []
})
afterEach(() => vi.unstubAllGlobals())

describe('JukeboxStudio', () => {
  it('sends the question of a demo button and plays the answer, after showing the wait', async () => {
    let finish: (response: Response) => void = () => {}
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(resolve => (finish = resolve)))
    vi.stubGlobal('fetch', fetchMock)
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Demo: Arctic sea ice' }))

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.query).toMatch(/Arctic sea ice/)
    expect(sent.accessibilityProfile).toEqual({ contrast: 'high', detailLevel: 'verbose' })
    expect(screen.getByRole('status')).toHaveTextContent('Orchestrating NASA data and auditing accessibility...')
    expect(screen.getByRole('button', { name: 'Demo: Amazon smoke' })).toBeDisabled()

    finish(reply(200, good))
    expect(await screen.findByText('Player at 90 with 1 descriptions')).toBeInTheDocument()
    expect(screen.queryByText('Orchestrating NASA data and auditing accessibility...')).not.toBeInTheDocument()
    expect(screen.queryByText(/did not approve/)).not.toBeInTheDocument()
  })

  it('sends a typed question with the chosen contrast and detail', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, good))
    vi.stubGlobal('fetch', fetchMock)
    show()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your question' }), 'Show wildfires')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Contrast' }), 'low')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Detail' }), 'brief')
    await userEvent.click(screen.getByRole('button', { name: 'Make music' }))
    await screen.findByText('Player at 90 with 1 descriptions')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ query: 'Show wildfires', accessibilityProfile: { contrast: 'low', detailLevel: 'brief' } })
  })

  it('says how long to wait when the server gives a Retry-After', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '12' } })))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Demo: Amazon smoke' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in about 12 seconds.')
    expect(announced.at(-1)).toMatch('Try again in about 12 seconds.')
  })

  it('limits the question to 300 characters', () => {
    show()
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveAttribute('maxlength', '300')
  })

  it.each([
    [429, /Too many requests/],
    [502, /could not finish/],
    [504, /could not finish/],
    [503, /switched off/],
  ])('shows a message for status %i, and Retry sends the same request again', async (status, message) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(status)).mockResolvedValueOnce(reply(200, good))
    vi.stubGlobal('fetch', fetchMock)
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Demo: Amazon smoke' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(announced.at(-1)).toMatch(message)

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Player at 90 with 1 descriptions')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says so when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Demo: Amazon smoke' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached')
  })

  it('says when nothing was made', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, { approved: false, feedback: 'No data', revisions: 0, audio: null, vision: null })))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Demo: Amazon smoke' }))
    expect(await screen.findByText(/nothing was made/)).toBeInTheDocument()
    expect(screen.queryByText(/Player at 90/)).not.toBeInTheDocument() // The offline box has its own player.
  })

  it('warns when the auditor did not approve, and keeps its note behind a details control marked as written by a model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, { ...good, approved: false, feedback: 'Too few descriptions.' })))
    const { container } = show()
    await userEvent.click(screen.getByRole('button', { name: 'Demo: Amazon smoke' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('did not approve')
    const summary = screen.getByText('Details (written by a model)')
    expect(summary.closest('details')).not.toHaveAttribute('open')
    await userEvent.click(summary)
    expect(screen.getByText('Too few descriptions.')).toBeVisible()
    expect(screen.getByText('Player at 90 with 1 descriptions')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('plays the pasted answer in the offline box, and says so when the text is not one', async () => {
    const { container } = show()
    await userEvent.click(screen.getByText('Load Raw JSON Payload (Offline Demo Mode)'))
    expect(screen.getByText('Player at 120 with 3 descriptions')).toBeInTheDocument()

    const box = screen.getByRole('textbox', { name: /as JSON/ })
    await userEvent.clear(box)
    await userEvent.click(box)
    await userEvent.paste(JSON.stringify(audio))
    await waitFor(() => expect(screen.getByText('Player at 90 with 0 descriptions')).toBeInTheDocument())

    await userEvent.clear(box)
    await userEvent.click(box)
    await userEvent.paste('nonsense')
    expect(screen.getByRole('alert')).toHaveTextContent('This is not an audio payload.')
    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations at the start', async () => {
    const { container } = show()
    await expectNoA11yViolations(container)
  })

  describe('Fetch live data (G11)', () => {
    const catalog = [{ id: 'fixture', title: 'Fixture ocean', summary: 'Four test frames.' }]
    const live = {
      mascot_reply: 'I found 2 days of Sentinel-2 scenes between 1 October 2026 and 2 October 2026.',
      dataset_theme: 'atmosphere',
      sonification_json: { ...audio, base_bpm: 100 },
      local_dataset_id: null,
    }

    /** The catalog file, then the mascot route, answered by `answer`. */
    function stub(answer: () => Promise<Response>) {
      const fetchMock = vi.fn((url: string, _init?: RequestInit) => (url.endsWith('index.json') ? Promise.resolve(reply(200, catalog)) : answer()))
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    async function ask(text = 'Cloud cover over Madagascar') {
      await userEvent.type(screen.getByRole('textbox', { name: 'Your question' }), text)
      await userEvent.click(screen.getByRole('button', { name: 'Fetch live data (Planetary Computer)' }))
    }

    it('shows Echo searching, then says, announces and plays the answer', async () => {
      let finish: (response: Response) => void = () => {}
      const fetchMock = stub(() => new Promise<Response>(resolve => (finish = resolve)))
      const { container } = show()
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Live data sound' }), 'bold')
      await ask()

      expect(await screen.findByText('Echo is fetching live data from Planetary Computer...')).toBeInTheDocument()
      expect(await screen.findByText('Echo looks searching and is thinking')).toBeInTheDocument()
      const call = fetchMock.mock.calls.find(([url]) => url.endsWith('/api/v1/mascot/query'))
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        user_prompt: 'Cloud cover over Madagascar',
        audio_preference: 'bold',
        catalog,
      })

      finish(reply(200, live))
      expect(await screen.findByText('Player at 100 with 0 descriptions')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: "Echo's answer" })).toHaveTextContent(live.mascot_reply)
      expect(announced.at(-1)).toBe(live.mascot_reply)
      expect(screen.getByText('Echo looks eq_active and is talking')).toBeInTheDocument()
      await expectNoA11yViolations(container)
    })

    it('shows the numbers behind the sound on request (WX02)', async () => {
      const series = { metric: 'Cloud cover', unit: '%', times: ['2026-10-01', '2026-10-02'], values: [10, 90] }
      stub(async () => reply(200, { ...live, series }))
      const { container } = show()
      await ask()
      await userEvent.click(await screen.findByText('Show the numbers'))
      expect(screen.getByRole('table', { name: 'Cloud cover (%): 2 values, one for each note' })).toBeInTheDocument()
      await expectNoA11yViolations(container)
    })

    it('shows the pictures in Echo\'s answer, next to the player (G12)', async () => {
      const url = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/47.4,-19,47.6,-18.8.png?item=x'
      stub(async () => reply(200, { ...live, images: [{ date: '2026-09-26', url }, { date: '2026-09-28', url }], image_legend: { kind: 'picture' }, image_area: [47.4, -19, 47.6, -18.8] }))
      show()
      await ask()
      const answer = await screen.findByRole('region', { name: "Echo's answer" })
      expect(answer).toHaveTextContent('2 picture pictures')
      expect(answer).toHaveTextContent('Player at 100 with 0 descriptions')
    })

    it('shows no pictures when the server sends none', async () => {
      stub(async () => reply(200, { ...live, images: [], image_legend: null, image_area: null }))
      show()
      await ask()
      await screen.findByText('Player at 100 with 0 descriptions')
      expect(screen.queryByText(/pictures$/)).not.toBeInTheDocument()
    })

    it('links to an app data set that answers the question', async () => {
      stub(async () => reply(200, { ...live, mascot_reply: "I already have 'Fixture ocean' in the app.", sonification_json: null, local_dataset_id: 'fixture' }))
      show()
      await ask('ocean test frames')
      expect(await screen.findByRole('link', { name: 'Open it in the app' })).toHaveAttribute('href', 'index.html#listen?data=fixture')
      expect(screen.getByText('Echo looks happy and is talking')).toBeInTheDocument()
      expect(screen.queryByText(/Player at 100/)).not.toBeInTheDocument()
    })

    it('shows the alert face when nothing was found', async () => {
      stub(async () => reply(200, { ...live, mascot_reply: 'I found no days of Sentinel-2 scenes there in those dates.', sonification_json: null }))
      show()
      await ask()
      expect(await screen.findByText(/found no days/)).toBeInTheDocument()
      expect(screen.getByText('Echo looks alert and is talking')).toBeInTheDocument()
    })

    it('says what went wrong, and Retry asks again', async () => {
      const answers = [reply(503), reply(200, live)]
      stub(async () => answers.shift() ?? reply(500))
      show()
      await ask()
      expect(await screen.findByRole('alert')).toHaveTextContent('switched off')
      expect(screen.getByText('Echo looks alert and is idle')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(await screen.findByText('Player at 100 with 0 descriptions')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
