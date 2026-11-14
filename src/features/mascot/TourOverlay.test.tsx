import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnouncerProvider } from '../../components'
import { TOUR_STEPS } from '../demo/script'
import { setMascotOn } from '../help/mascotSetting'
import { expectNoA11yViolations } from '../../test/a11y'
import MascotDock from './MascotDock'
import { MascotGuideProvider } from './MascotGuideProvider'
import { getTour, MISSING_NOTE, stopTour } from './tour'

/** The three controls the tour points at, as the Listen page has them. */
function Page({ missing = false }: { missing?: boolean }) {
  return (
    <main>
      <div data-tour="dataset-picker"><label>Data set<select><option>One</option></select></label></div>
      {!missing && <button type="button" data-tour="play">Play</button>}
      <div data-tour="mixer"><span>Speed</span><label>Volume<input type="range" /></label></div>
    </main>
  )
}

function App({ missing }: { missing?: boolean }) {
  return (
    <AnnouncerProvider>
      <MascotGuideProvider>
        <Page missing={missing} />
        <MascotDock page="listen" loading={false} voice="idle" voiceOpen={false} onTalk={() => {}} />
      </MascotGuideProvider>
    </AnnouncerProvider>
  )
}

function reduceMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

async function startTour(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Echo, your guide' }))
  await user.click(screen.getByRole('button', { name: 'Show me around' }))
}

const caption = () => document.querySelector('.tour-bar__caption')?.textContent ?? ''
const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''

beforeEach(() => {
  setMascotOn(true)
  localStorage.clear()
  reduceMotion(true)
})
afterEach(async () => {
  act(() => stopTour())
  await waitFor(() => expect(getTour().active).toBe(false))
  vi.useRealTimers()
  vi.unstubAllGlobals()
  window.location.hash = ''
})

describe('the guided tour', () => {
  it('starts from Show me around: the dock steps aside, the caption is spoken, and focus goes to Next', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startTour(user)
    expect(screen.getByRole('region', { name: 'Guided tour' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Echo, your guide' })).not.toBeInTheDocument()
    await waitFor(() => expect(caption()).toBe(TOUR_STEPS[0].say))
    expect(liveText()).toBe(TOUR_STEPS[0].say)
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus()
  })

  it('puts Echo and a ring beside each control, with no flight under reduced motion', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await startTour(user)
    await waitFor(() => expect(document.querySelector('.tour__echo')).toBeInTheDocument())
    expect(document.querySelector('.tour__echo')).toHaveAttribute('data-flying', 'false')
    expect(document.querySelector('.tour__ring')).toBeInTheDocument()
    expect(document.querySelector('.tour__trail')).not.toBeInTheDocument()
    // The overlay is decoration: hidden from a screen reader, and it takes no clicks.
    expect(document.querySelector('.tour__stop')).toHaveAttribute('aria-hidden', 'true')
    await expectNoA11yViolations(container)
  })

  it('moves between steps with Next and Back, and Next leaves focus where it was', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startTour(user)
    await waitFor(() => expect(caption()).toBe(TOUR_STEPS[0].say))

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(caption()).toBe(TOUR_STEPS[1].say))
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus()
    expect(liveText()).toBe(TOUR_STEPS[1].say)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(caption()).toBe(TOUR_STEPS[2].say))
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(caption()).toBe(TOUR_STEPS[1].say))
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
  })

  it('ends on Finish, says so, and gives the dock back with focus', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startTour(user)
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      await waitFor(() => expect(caption()).toBe(TOUR_STEPS[i].say))
      await user.click(screen.getByRole('button', { name: i === TOUR_STEPS.length - 1 ? 'Finish' : 'Next' }))
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Echo, your guide' })).toHaveFocus())
    expect(screen.queryByRole('region', { name: 'Guided tour' })).not.toBeInTheDocument()
    expect(liveText()).toBe('The tour has finished.')
  })

  it('stops on Escape and on Stop tour, and the dock comes back', async () => {
    const user = userEvent.setup()
    render(<App />)
    await startTour(user)
    await waitFor(() => expect(caption()).toBe(TOUR_STEPS[0].say))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Echo, your guide' })).toBeVisible())
    expect(liveText()).toBe('The tour was stopped.')

    await startTour(user)
    await user.click(screen.getByRole('button', { name: 'Stop tour' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Echo, your guide' })).toBeVisible())
    expect(getTour().active).toBe(false)
  })

  it('flies with a trail when motion is allowed, and arrives pointing', async () => {
    reduceMotion(false)
    const user = userEvent.setup()
    render(<App />)
    await startTour(user)
    await waitFor(() => expect(document.querySelector('.tour__echo')).toHaveAttribute('data-flying', 'true'))
    expect(document.querySelector('.tour__trail')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.tour__echo')).toHaveAttribute('data-flying', 'false'), { timeout: 3000 })
    expect(document.querySelector('.tour__trail')).toBeInTheDocument()
  })

  it('does not fly to a control that is not there, and says what to do', async () => {
    const user = userEvent.setup()
    render(<App missing />)
    await startTour(user)
    await waitFor(() => expect(caption()).toBe(TOUR_STEPS[0].say))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(caption()).toContain(MISSING_NOTE), { timeout: 3000 })
    expect(caption()).toContain(TOUR_STEPS[1].say)
    expect(document.querySelector('.tour__ring')).not.toBeInTheDocument()
    expect(document.querySelector('.tour__echo')).not.toBeInTheDocument()
    // It still waits for Next, so the listener can open a data set first.
    expect(getTour().active).toBe(true)
  })
})
