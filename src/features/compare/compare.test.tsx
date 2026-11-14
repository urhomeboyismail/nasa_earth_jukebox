import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { subscribeContext, type ContextUpdate } from '../../assistant/context'
import type { Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import ComparePage from '.'
import { AnnouncerProvider } from '../../components'

// jsdom has no ResizeObserver, which the RangeSlider (Radix) uses to measure its handles.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })


const visualization = fixture as Visualization
const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const

const calls = vi.hoisted(() => [] as string[])
// AU-UI: the interface cues, in the order they and the engine's sounds happened.
const cueLog = vi.hoisted(() => [] as string[])
const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => { calls.push('unlock') }),
  playCategory: vi.fn((id: string) => { calls.push(`category:${id}`) }),
  playMissing: vi.fn(() => { calls.push('missing') }),
  stop: vi.fn(() => { calls.push('stop') }),
  setStyle: vi.fn(),
  setSpatial: vi.fn(),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))
vi.mock('../../audio/cues', async importOriginal => ({
  ...(await importOriginal<typeof import('../../audio/cues')>()),
  playCue: vi.fn((cue: string) => { cueLog.push(cue); calls.push('cue'); return 0 }),
}))

const analyzeAll = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll }))

const analysis = () => visualization.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: i === 3 ? 0 : 9, category: CATEGORIES[i] }))

beforeEach(() => {
  calls.length = 0
  cueLog.length = 0
  vi.clearAllMocks()
  analyzeAll.mockImplementation(async () => analysis())
})

async function renderReady() {
  const user = userEvent.setup()
  const view = render(<ComparePage visualization={visualization} />, { wrapper: AnnouncerProvider })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play date A' })).toBeEnabled())
  return { user, ...view }
}
const sounded = () => calls.filter(c => c !== 'stop' && c !== 'unlock' && c !== 'cue')

describe('Compare: the ready-made comparison', () => {
  it('shows the question, and the buttons are off until the analysis finishes', async () => {
    let finish!: (value: ReturnType<typeof analysis>) => void
    analyzeAll.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<ComparePage visualization={visualization} />, { wrapper: AnnouncerProvider })
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
    expect(calls.filter(c => c !== 'stop' && c !== 'cue')).toEqual(['unlock', 'category:cold', 'unlock', 'category:hot'])
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

  it('describes both dates in words under their pictures after the reveal, and not before', async () => {
    const { user } = await renderReady()
    expect(screen.queryByText(/First date\./)).toBeNull()
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    await user.click(screen.getByRole('button', { name: 'Reveal the answer' }))
    const [cardA, cardB] = screen.getAllByRole('img').map(img => img.closest('section')!)
    expect(cardA).toHaveTextContent('First date.')
    expect(cardB).toHaveTextContent('December 2024.')
    expect(cardB).toHaveTextContent('Up two steps from July (mild).')
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
    expect(screen.getByRole('radio', { name: 'Two dates' })).toHaveFocus()
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

  it('has a two-handle scrubber that shows the same two dates as the choosers', async () => {
    const { container } = await openCustom()
    expect(screen.getByRole('slider', { name: 'Date A' })).toHaveAttribute('aria-valuetext', 'January 2024')
    expect(screen.getByRole('slider', { name: 'Date B' })).toHaveAttribute('aria-valuetext', 'March 2025')
    await expectNoA11yViolations(container)
  })

  it('sets deck A from the "Date A" handle, announces it, and keeps the chooser in sync', async () => {
    const { user } = await openCustom()
    screen.getByRole('slider', { name: 'Date A' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('combobox', { name: 'Date A' })).toHaveValue(visualization.frames[1].id)
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('Date A: July 2024.')
  })

  it('moves the handle when a chooser changes, and clears the answer when a handle moves', async () => {
    const { user } = await openCustom()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date B' }), 'July 2024')
    expect(screen.getByRole('slider', { name: 'Date B' })).toHaveAttribute('aria-valuetext', 'July 2024')
    await user.click(screen.getByRole('radio', { name: 'B is warmer' }))
    screen.getByRole('slider', { name: 'Date B' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('combobox', { name: 'Date B' })).toHaveValue(visualization.frames[2].id)
    expect(screen.getByRole('radio', { name: 'B is warmer' })).not.toBeChecked()
  })

  it('keeps each handle named for its own deck when the choosers put B before A', async () => {
    const { user } = await openCustom()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date A' }), 'December 2024')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date B' }), 'January 2024')
    const lowHandle = screen.getAllByRole('slider')[0]
    expect(lowHandle).toHaveAccessibleName('Date B')
    lowHandle.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('combobox', { name: 'Date B' })).toHaveValue(visualization.frames[1].id)
    expect(screen.getByRole('combobox', { name: 'Date A' })).toHaveValue(visualization.frames[2].id)
  })
})

describe('Compare: the voice guide and cleanup', () => {
  it('publishes the comparison, and announces the reveal once', async () => {
    const updates: ContextUpdate[] = []
    const unsubscribe = subscribeContext(update => updates.push(update))
    const { user, unmount } = await renderReady()
    expect(updates.at(-1)).toMatchObject({ key: 'compare', data: { frameA: '2024-01-15', frameB: '2024-12-15', answered: false, revealed: false, testInProgress: false } })
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
    render(<ComparePage visualization={visualization} />, { wrapper: AnnouncerProvider })
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be prepared.*worker crashed/)
  })

  it('shows a loading message until the data arrives', () => {
    render(<ComparePage visualization={null} />, { wrapper: AnnouncerProvider })
    expect(screen.getByText(/Loading the data/)).toBeInTheDocument()
  })
})

describe('Compare: a comparison that names a date the data set does not have', () => {
  const broken: Visualization = { ...visualization, comparisons: [{ ...visualization.comparisons[0], frameB: 'no-such-date' }, ...visualization.comparisons.slice(1)] }

  it('says so in a notice, keeps the comparison list, and does not throw', async () => {
    const user = userEvent.setup()
    const { container } = render(<ComparePage visualization={broken} />, { wrapper: AnnouncerProvider })
    expect(screen.getByText(/names a date that is not in the data set/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play date A' })).toBeNull()
    await expectNoA11yViolations(container)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Comparison' }), 'custom')
    expect(await screen.findByRole('button', { name: 'Play date A' })).toBeInTheDocument()
    expect(screen.queryByText(/names a date that is not in the data set/)).toBeNull()
  })
})

describe('Compare: the test-mode flag', () => {
  it('opens the listening test when the page is given true, and the normal page when it is false', () => {
    const { rerender } = render(<ComparePage visualization={visualization} testMode />, { wrapper: AnnouncerProvider })
    expect(screen.getByText('Listening test')).toBeInTheDocument()
    rerender(<ComparePage visualization={visualization} testMode={false} />)
    expect(screen.queryByText('Listening test')).toBeNull()
    expect(screen.getByRole('button', { name: 'Play date A' })).toBeInTheDocument()
  })
})

describe('Compare: interface cues (AU-UI)', () => {
  it('blips once before date A and twice (as compareB) before date B, each ahead of its sound', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play date A' }))
    await user.click(screen.getByRole('button', { name: 'Play date B' }))
    expect(cueLog).toEqual(['compareA', 'compareB'])
    // Each cue comes after the unlock and before the date's own sound.
    expect(calls.filter(c => c !== 'stop').map(c => c.replace(/^category:.*/, 'category'))).toEqual(['unlock', 'cue', 'category', 'unlock', 'cue', 'category'])
  })
})
