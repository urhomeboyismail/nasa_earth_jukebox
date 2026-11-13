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
})
