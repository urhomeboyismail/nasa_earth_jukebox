import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnouncerContext } from '../../components/announcerContext'
import { expectNoA11yViolations } from '../../test/a11y'
import { installFakeAudioContext } from '../../test/fakes'
import LivePage from '.'

// The pictures have their own tests (LiveImages.test.tsx); here a marker that shows what they were given.
vi.mock('../jukebox/LiveImages', () => ({
  LiveImages: ({ pictures }: { pictures: { images: unknown[] } }) => <p>{pictures.images.length} pictures</p>,
}))

const catalog = [{ id: 'fixture', title: 'Fixture ocean', summary: 'Four test frames.' }]
const url = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/57,-21,58,-20.png?item=a'
const live = {
  mascot_reply: 'I found 2 days of sea surface temperature.',
  dataset_theme: 'ocean',
  sonification_json: { base_bpm: 100, tracks: [{ instrument: 'marimba', pitch_range: [52, 76], volume_curve: [0.15, 1] }] },
  local_dataset_id: null,
  series: { metric: 'Sea surface temperature', unit: '°C', times: ['2026-06-01', '2026-06-02'], values: [24.1, 24.6] },
  images: [{ date: '2026-06-01', url }, { date: '2026-06-02', url }],
  image_legend: { kind: 'picture' },
  image_area: [57, -21, 58, -20],
}

const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })

/** The catalog file, then the live data route, answered by `answer`. */
function stub(answer: () => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => (String(input).endsWith('index.json') ? Promise.resolve(reply(200, catalog)) : answer()))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

let announced: string[]
let audio: ReturnType<typeof installFakeAudioContext>

function show() {
  return render(
    <AnnouncerContext.Provider value={text => announced.push(text)}>
      <LivePage />
    </AnnouncerContext.Provider>,
  )
}

beforeEach(() => {
  announced = []
  audio = installFakeAudioContext()
})
afterEach(() => audio.uninstall())

describe('Live data page (G13)', () => {
  it('keeps Fetch live data off until there is a question, and passes accessibility checks', async () => {
    stub(async () => reply(200, live))
    const { container } = show()
    const fetchButton = screen.getByRole('button', { name: 'Fetch live data' })
    expect(fetchButton).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your question' }), '   ')
    expect(fetchButton).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveAttribute('maxLength', '300')
    await expectNoA11yViolations(container)
  })

  it('sends the typed question and the sound choice, says it is waiting, then shows and announces the answer', async () => {
    let finish: (response: Response) => void = () => {}
    const fetchMock = stub(() => new Promise<Response>(resolve => (finish = resolve)))
    const { container } = show()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your question' }), 'Sea temperature near Mauritius')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Live data sound' }), 'gentle')
    await userEvent.click(screen.getByRole('button', { name: 'Fetch live data' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Fetching live data from Planetary Computer…')
    const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/v1/mascot/query'))
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ user_prompt: 'Sea temperature near Mauritius', audio_preference: 'gentle', catalog })

    finish(reply(200, live))
    const answer = await screen.findByRole('region', { name: "Echo's answer" })
    expect(answer).toHaveTextContent(live.mascot_reply)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByText('Show the numbers')).toBeInTheDocument()
    expect(answer).toHaveTextContent('2 pictures')
    expect(announced.at(-1)).toBe(live.mascot_reply)
    expect(screen.queryByRole('status')).toBeNull()
    await expectNoA11yViolations(container)
  })

  it('fills the box from an example question and fetches it', async () => {
    const fetchMock = stub(async () => reply(200, live))
    show()
    const examples = screen.getByRole('group', { name: 'Example questions' })
    const first = examples.querySelector('button')
    await userEvent.click(first!)
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue(first!.textContent)
    await screen.findByRole('region', { name: "Echo's answer" })
    const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/v1/mascot/query'))
    expect(JSON.parse(String(call?.[1]?.body)).user_prompt).toBe(first!.textContent)
  })

  it.each([
    [503, /Live data is switched off on this server/],
    [429, /Too many requests/],
  ])('says a %i in words, and Retry asks again', async (status, words) => {
    const answers = [reply(status), reply(200, live)]
    const fetchMock = stub(async () => answers.shift() ?? reply(200, live))
    const { container } = show()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your question' }), 'Clouds over Madagascar')
    await userEvent.click(screen.getByRole('button', { name: 'Fetch live data' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(words)
    expect(announced.at(-1)).toMatch(words)
    await expectNoA11yViolations(container)

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('region', { name: "Echo's answer" })).toHaveTextContent(live.mascot_reply)
    expect(screen.queryByRole('alert')).toBeNull()
    const calls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/api/v1/mascot/query'))
    expect(calls).toHaveLength(2)
    expect(calls[1][1]?.body).toBe(calls[0][1]?.body)
  })

  it('says so when the server cannot be reached', async () => {
    stub(() => Promise.reject(new TypeError('failed')))
    show()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your question' }), 'Clouds over Madagascar')
    await userEvent.click(screen.getByRole('button', { name: 'Fetch live data' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The server could not be reached. Is it running?')
    expect(screen.getByRole('alert')).not.toHaveTextContent('offline demo')
  })
})
