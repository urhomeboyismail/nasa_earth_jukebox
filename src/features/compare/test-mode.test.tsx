import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import ComparePage from '.'

const base = fixture as Visualization
// Two comparisons, so the fixed order can be seen.
const visualization: Visualization = {
  ...base,
  comparisons: [
    base.comparisons[0],
    { id: 'july-vs-december', regionId: 'centre', frameA: '2024-07-15', frameB: '2024-12-15', question: 'Which is warmer, July or December?', answer: 'b', explanation: 'December is red.' },
  ],
}
const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const

const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => {}),
  playCategory: vi.fn(),
  playMissing: vi.fn(),
  stop: vi.fn(),
  setStyle: vi.fn(),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))
const analyzeAll = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll }))

type Call = { url: string; body: Record<string, unknown> }
let calls: Call[]
let failNext: number

beforeEach(() => {
  vi.clearAllMocks()
  window.location.hash = '#compare?test=1'
  calls = []
  failNext = 0
  analyzeAll.mockImplementation(async () => visualization.frames.map((f, i) => ({ frameId: f.id, regionId: 'centre', sampled: 9, valid: 9, category: CATEGORIES[i] })))
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    if (failNext > 0) { failNext--; throw new TypeError('Failed to fetch') }
    return url.endsWith('/responses') ? new Response(null, { status: 204 }) : new Response(JSON.stringify({ id: 'sess1' }), { status: 201 })
  }))
})
afterEach(() => { vi.unstubAllGlobals(); window.location.hash = '' })

const responsesPosted = () => calls.filter(c => c.url.endsWith('/responses'))

async function toQuestions(user: ReturnType<typeof userEvent.setup>, options: { images?: boolean } = {}) {
  await user.click(screen.getByRole('checkbox', { name: /I agree to take part/ }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await user.click(screen.getByRole('radio', { name: 'I am blind or have low vision' }))
  await user.click(screen.getByRole('checkbox', { name: /screen reader/ }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  if (options.images) await user.click(screen.getByRole('radio', { name: 'Show the pictures too' }))
  await user.click(screen.getByRole('button', { name: 'Start the test' }))
  await screen.findByRole('heading', { name: 'Question 1 of 2' })
}

describe('Test mode: opening', () => {
  it('opens only from #compare?test=1', async () => {
    window.location.hash = '#compare'
    render(<ComparePage visualization={visualization} />)
    expect(screen.queryByText('Listening test')).toBeNull()
    expect(screen.getByRole('button', { name: 'Play date A' })).toBeInTheDocument()
    act(() => { window.location.hash = '#compare?test=1' })
    expect(await screen.findByText('Listening test')).toBeInTheDocument()
    act(() => { window.location.hash = '#compare' })
    expect(await screen.findByRole('button', { name: 'Reveal the answer' })).toBeInTheDocument()
  })

  it('starts with the consent step in plain words, and cannot continue without agreeing', async () => {
    const user = userEvent.setup()
    render(<ComparePage visualization={visualization} />)
    expect(screen.getByRole('heading', { name: 'Before you start' })).toBeInTheDocument()
    expect(screen.getByText(/do not store your IP address/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /I agree to take part/ }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('needs the participant group before going on', async () => {
    const user = userEvent.setup()
    render(<ComparePage visualization={visualization} />)
    await user.click(screen.getByRole('checkbox', { name: /I agree to take part/ }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'I would rather not say' }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('defaults to audio only', async () => {
    const user = userEvent.setup()
    render(<ComparePage visualization={visualization} />)
    await user.click(screen.getByRole('checkbox', { name: /I agree to take part/ }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('radio', { name: 'I can see the screen' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('radio', { name: /Audio only/ })).toBeChecked()
  })

  it('has no accessibility violations on any step', async () => {
    const user = userEvent.setup()
    const { container } = render(<ComparePage visualization={visualization} />)
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('checkbox', { name: /I agree to take part/ }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('radio', { name: 'I am blind or have low vision' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('button', { name: 'Start the test' }))
    await screen.findByRole('heading', { name: 'Question 1 of 2' })
    await expectNoA11yViolations(container)
  })
})

describe('Test mode: a full session', () => {
  it('sends the session, then each answer in the fixed order, with timing, confidence and comment', async () => {
    const user = userEvent.setup()
    render(<ComparePage visualization={visualization} />)
    await toQuestions(user)

    expect(calls[0]).toEqual({ url: '/api/v1/tests', body: { participant: 'blind_low_vision', screenReader: true, sawImages: false, consent: true } })

    await user.click(screen.getByRole('button', { name: 'Play date A' }))
    await user.click(screen.getByRole('button', { name: 'Play date B' }))
    expect(engine.playCategory.mock.calls).toEqual([['cold'], ['hot']])
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.type(screen.getByRole('textbox', { name: /Anything you want to tell us/ }), '  Clear difference.  ')
    await user.click(screen.getByRole('button', { name: 'Submit and go to the next question' }))

    expect(await screen.findByRole('heading', { name: 'Question 2 of 2' })).toHaveFocus()
    expect(screen.getByText('Which is warmer, July or December?')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'A is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Submit and finish' }))
    await screen.findByRole('heading', { name: 'Thank you' })

    const [first, second] = responsesPosted()
    expect(first.url).toBe('/api/v1/tests/sess1/responses')
    expect(first.body).toMatchObject({ comparisonId: 'january-vs-december', answer: 'b', correct: true, confidence: 4, comment: 'Clear difference.' })
    expect(first.body.responseMs).toEqual(expect.any(Number))
    expect(second.body).toMatchObject({ comparisonId: 'july-vs-december', answer: 'a', correct: false })
    expect(second.body).not.toHaveProperty('confidence')
    expect(second.body).not.toHaveProperty('comment')
    expect(await screen.findByText(/All 2 of your answers were sent/)).toBeInTheDocument()
  })

  it('never shows the right answer or the explanation during the test', async () => {
    const user = userEvent.setup()
    render(<ComparePage visualization={visualization} />)
    await toQuestions(user)
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Submit and go to the next question' }))
    expect(screen.queryByText(/Correct/)).toBeNull()
    expect(screen.queryByText(base.comparisons[0].explanation)).toBeNull()
  })

  it('keeps pictures hidden for audio only, and shows them when asked', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ComparePage visualization={visualization} />)
    await toQuestions(user)
    expect(screen.queryByRole('img')).toBeNull()
    unmount()

    render(<ComparePage visualization={visualization} />)
    await toQuestions(user, { images: true })
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(calls.at(-1)!.body).toBeDefined()
    expect(calls.find(c => c.url === '/api/v1/tests' && c.body.sawImages === true)).toBeDefined()
  })

  it('needs an answer to go on, and the confidence and comment are optional', async () => {
    const user = userEvent.setup()
    render(<ComparePage visualization={visualization} />)
    await toQuestions(user)
    expect(screen.getByRole('button', { name: 'Submit and go to the next question' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'About the same' }))
    expect(screen.getByRole('button', { name: 'Submit and go to the next question' })).toBeEnabled()
  })

  it('limits comments to 500 characters and shows the count', async () => {
    const user = userEvent.setup()
    render(<ComparePage visualization={visualization} />)
    await toQuestions(user)
    const box = screen.getByRole('textbox', { name: /Anything you want to tell us/ })
    expect(box).toHaveAttribute('maxlength', '500')
    await user.type(box, 'hello')
    expect(screen.getByText('5 of 500 characters')).toBeInTheDocument()
  })

  it('works by keyboard alone', async () => {
    const user = userEvent.setup()
    render(<ComparePage visualization={visualization} />)
    await user.tab()
    expect(screen.getByRole('checkbox', { name: /I agree to take part/ })).toHaveFocus()
    await user.keyboard(' ')
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: 'About you' })).toHaveFocus()
  })
})

describe('Test mode: when the network fails', () => {
  it('keeps the answer, says so, and sends it when the connection comes back', async () => {
    const user = userEvent.setup()
    render(<ComparePage visualization={visualization} />)
    await toQuestions(user)
    failNext = 2 // the first attempt and the first automatic retry both fail, so the answer is still waiting at the end
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Submit and go to the next question' }))
    await user.click(await screen.findByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Submit and finish' }))
    await screen.findByRole('heading', { name: 'Thank you' })
    expect(await screen.findByText(/have not been sent yet|has not been sent yet/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try sending now' }))
    expect(await screen.findByText(/All 2 of your answers were sent/)).toBeInTheDocument()
    // However many tries it took, each answer was stored, and the second never overtook the first.
    const ids = responsesPosted().map(c => c.body.comparisonId)
    expect(ids.at(-1)).toBe('july-vs-december')
    expect(ids.filter(id => id === 'july-vs-december')).toHaveLength(1)
    expect(ids.lastIndexOf('january-vs-december')).toBeLessThan(ids.indexOf('july-vs-december'))
  })
})
