import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { subscribeContext, type ContextUpdate } from '../../assistant/context'
import type { Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import ComparePage from '.'

const visualization = fixture as Visualization
const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const

const calls = vi.hoisted(() => [] as string[])
const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => { calls.push('unlock') }),
  playCategory: vi.fn((id: string) => { calls.push(`category:${id}`) }),
  playMissing: vi.fn(() => { calls.push('missing') }),
  stop: vi.fn(() => { calls.push('stop') }),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))

const analyzeAll = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll }))

const analysis = () => visualization.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: i === 3 ? 0 : 9, category: CATEGORIES[i] }))

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
  analyzeAll.mockImplementation(async () => analysis())
})

async function renderReady() {
  const user = userEvent.setup()
  const view = render(<ComparePage visualization={visualization} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play date A' })).toBeEnabled())
  return { user, ...view }
}
const sounded = () => calls.filter(c => c !== 'stop' && c !== 'unlock')

describe('Compare: the ready-made comparison', () => {
  it('shows the question, and the buttons are off until the analysis finishes', async () => {
    let finish!: (value: ReturnType<typeof analysis>) => void
    analyzeAll.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<ComparePage visualization={visualization} />)
    expect(screen.getByText('Analyzing the images…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play date A' })).toBeDisabled()
    expect(screen.getByText(fixture.comparisons[0].question)).toBeInTheDocument()
    await act(async () => { finish(analysis()) })
    expect(screen.getByRole('button', { name: 'Play date A' })).toBeEnabled()
  })

  it('plays each date as the note its analysis gave, unlocking the sound first', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play date A' }))
    await user.click(screen.getByRole('button', { name: 'Play date B' }))
    expect(calls.filter(c => c !== 'stop')).toEqual(['unlock', 'category:cold', 'unlock', 'category:hot'])
  })

  it('keeps the images hidden until the answer is revealed', async () => {
    const { user } = await renderReady()
    expect(screen.queryByRole('img')).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    expect(screen.queryByRole('img')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByRole('img', { name: visualization.frames[0].altText })).toBeInTheDocument()
  })

  it('does not show the dates before the reveal, so they cannot give the answer away', async () => {
    await renderReady()
    expect(screen.queryByText(/January 2024/)).toBeNull()
    expect(screen.queryByText(/December 2024/)).toBeNull()
  })

  it('needs an answer before it will reveal', async () => {
    const { user } = await renderReady()
    expect(screen.getByRole('button', { name: 'Reveal the answer' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'About the same' }))
    expect(screen.getByRole('button', { name: 'Reveal the answer' })).toBeEnabled()
  })

  it('says a right answer is correct, with the explanation from the data', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    const result = screen.getByRole('region', { name: 'Result' })
    expect(result).toHaveTextContent('Correct.')
    expect(result).toHaveTextContent('Date B is warmer.')
    expect(result).toHaveTextContent(fixture.comparisons[0].explanation)
    expect(screen.getByRole('heading', { level: 2, name: 'Date A: January 2024' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Date B: December 2024' })).toBeInTheDocument()
  })

  it('says a wrong answer is not quite right, and still gives the answer', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('radio', { name: 'A is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    expect(screen.getByLabelText('Result')).toHaveTextContent(/Not quite\..*Date B is warmer\./)
  })

  it('locks the answer after the reveal, and lets you try again', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    expect(screen.getByRole('radio', { name: 'A is warmer' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Try this comparison again' }))
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByRole('radio', { name: 'B is warmer' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'B is warmer' })).toBeEnabled()
  })

  it('moves focus to the result on reveal and back to the play buttons on try again', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    expect(screen.getByLabelText('Result')).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Try this comparison again' }))
    expect(screen.getByRole('button', { name: 'Play date A' })).toHaveFocus()
  })

  it('leaves focus on the dropdown when it is changed after a reveal, and not on the play button at load', async () => {
    const { user } = await renderReady()
    expect(screen.getByRole('button', { name: 'Play date A' })).not.toHaveFocus()
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    const choice = screen.getByRole('combobox', { name: 'Comparison' })
    await user.selectOptions(choice, 'Choose my own two dates')
    expect(choice).toHaveFocus()
  })

  it('goes from start to finish by keyboard alone', async () => {
    const { user } = await renderReady()
    await user.tab()
    expect(screen.getByRole('combobox', { name: 'Comparison' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Play date A' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.tab()
    await user.keyboard(' ')
    expect(sounded()).toEqual(['category:cold', 'category:hot'])
    await user.tab() // into the answer options
    await user.keyboard('{ArrowDown}') // A → B
    expect(screen.getByRole('radio', { name: 'B is warmer' })).toBeChecked()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Reveal the answer' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Result')).toHaveTextContent('Correct.')
  })

  it('has no accessibility violations before and after the reveal', async () => {
    const { user, container } = await renderReady()
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    await expectNoA11yViolations(container)
  })
})

describe('Compare: choosing your own dates', () => {
  async function openCustom() {
    const view = await renderReady()
    await view.user.selectOptions(screen.getByRole('combobox', { name: 'Comparison' }), 'Choose my own two dates')
    return view
  }

  it('offers every date for A and for B', async () => {
    await openCustom()
    expect(screen.getByRole('combobox', { name: 'Date A' }).querySelectorAll('option')).toHaveLength(4)
    expect(screen.getByRole('combobox', { name: 'Date B' }).querySelectorAll('option')).toHaveLength(4)
  })

  it('works out the right answer from what the analysis heard', async () => {
    const { user } = await openCustom()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date A' }), 'December 2024')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date B' }), 'July 2024')
    await user.click(screen.getByRole('radio', { name: 'A is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    expect(screen.getByLabelText('Result')).toHaveTextContent(/Correct\..*Date A is warmer\..*December 2024 sounded hot and July 2024 sounded mild/)
  })

  it('says "about the same" for two dates in the same category', async () => {
    const { user } = await openCustom()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date A' }), 'January 2024')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date B' }), 'January 2024')
    await user.click(screen.getByRole('radio', { name: 'About the same' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    expect(screen.getByLabelText('Result')).toHaveTextContent('Correct.')
  })

  it('will not ask for an answer when a date has no data, and says why', async () => {
    const { user } = await openCustom()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date B' }), 'March 2025')
    expect(screen.getByText(/no usable data/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'A is warmer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reveal the answer' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Play date B' }))
    expect(sounded()).toEqual(['missing'])
  })

  it('clears the answer when the dates change', async () => {
    const { user } = await openCustom()
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date A' }), 'July 2024')
    expect(screen.getByRole('radio', { name: 'B is warmer' })).not.toBeChecked()
  })
})

describe('Compare: the voice guide and cleanup', () => {
  it('publishes the comparison, and announces the reveal once', async () => {
    const updates: ContextUpdate[] = []
    const unsubscribe = subscribeContext(update => updates.push(update))
    const { user, unmount } = await renderReady()
    expect(updates.at(-1)).toMatchObject({ key: 'compare', data: { frameA: '2024-01-15', frameB: '2024-12-15', answered: false, revealed: false } })
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    expect(updates.at(-1)).toMatchObject({ data: { answered: true, revealed: false } })
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    expect(updates.at(-1)).toMatchObject({ data: { revealed: true }, announce: 'comparison_revealed:january-vs-december' })
    expect(updates.filter(u => u.announce)).toHaveLength(1)
    unmount()
    expect(updates.at(-1)).toMatchObject({ key: 'compare', data: null })
    unsubscribe()
  })

  it('announces the result in the shared live region', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent(/Correct\. Date B is warmer\./)
  })

  it('silences the sounds when the page is left', async () => {
    const { unmount } = await renderReady()
    engine.stop.mockClear()
    unmount()
    expect(engine.stop).toHaveBeenCalled()
  })

  it('says so when a sound cannot be played, and clears the message on the next try', async () => {
    const { user } = await renderReady()
    engine.unlock.mockRejectedValueOnce(new Error('audio blocked'))
    await user.click(screen.getByRole('button', { name: 'Play date A' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be played.*audio blocked/)
    expect(sounded()).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Play date A' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(sounded()).toEqual(['category:cold'])
  })

  it('says so when the sounds cannot be prepared', async () => {
    analyzeAll.mockRejectedValue(new Error('worker crashed'))
    render(<ComparePage visualization={visualization} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be prepared.*worker crashed/)
  })

  it('shows a loading message until the data arrives', () => {
    render(<ComparePage visualization={null} />)
    expect(screen.getByText(/Loading the data/)).toBeInTheDocument()
  })
})
