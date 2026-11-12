import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixtureManifest from '../../../public/data/fixture/manifest.json'
import oceanManifest from '../../../public/data/synthetic-ocean/manifest.json'
import { publishContext } from '../../assistant/context'
import { AnnouncerProvider } from '../../components'
import type { Visualization } from '../../data'
import { visualizationSchema } from '../../data/schema'
import type { AssistantStatus } from '../../hooks/useVoiceAssistant'
import { expectNoA11yViolations } from '../../test/a11y'
import { setMascotOn } from '../help/mascotSetting'
import { TIPS } from '../help/tips'
import MascotDock from './MascotDock'
import { MascotGuideProvider } from './MascotGuideProvider'
import { IDLE_CHECK_MS } from './useFaceState'
import { useMascotGuide } from './useMascotGuide'
import type { Tip } from './guideContext'

/** A page that offers Echo a tip, as a real page would from an effect or an event. */
function OfferButton({ tip }: { tip: Tip }) {
  const guide = useMascotGuide()
  return <button type="button" onClick={() => guide.offerTip(tip)}>Offer a tip</button>
}

type Props = Partial<{ page: 'home' | 'listen'; loading: boolean; voice: AssistantStatus; voiceOpen: boolean; onTour: () => void; onTalk: () => void; tip: Tip; visualization: Visualization | null }>

function Dock({ page = 'listen', loading = false, voice = 'idle', voiceOpen = false, onTour, onTalk = () => {}, tip = { text: 'Try the date slider.' }, visualization }: Props) {
  return (
    <AnnouncerProvider>
      <MascotGuideProvider>
        <OfferButton tip={tip} />
        <MascotDock page={page} loading={loading} voice={voice} voiceOpen={voiceOpen} onTalk={onTalk} onTour={onTour} visualization={visualization} />
      </MascotGuideProvider>
    </AnnouncerProvider>
  )
}

const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''
const echoButton = (name = 'Echo, your guide') => screen.getByRole('button', { name })
const face = (container: HTMLElement) => container.querySelector('svg[data-expression]')?.getAttribute('data-expression')

beforeEach(() => {
  setMascotOn(true)
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  setMascotOn(true)
  publishContext('player', null)
})

describe('the dock', () => {
  it('is a button named for Echo, closed to begin with', () => {
    render(<Dock />)
    expect(echoButton()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Echo, your guide' })).not.toBeInTheDocument()
  })

  it('opens on a click, shows and announces the page tip once, and closes on Esc with focus back on the button', async () => {
    const user = userEvent.setup()
    render(<Dock />)
    await user.click(echoButton())
    expect(echoButton()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Echo, your guide' })).toHaveTextContent(TIPS.listen)
    expect(liveText()).toBe(TIPS.listen)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Echo, your guide' })).not.toBeInTheDocument()
    expect(echoButton()).toHaveFocus()
  })

  it('opens from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Dock />)
    echoButton().focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('region', { name: 'Echo, your guide' })).toBeInTheDocument()
  })

  it('says it has a tip when one is offered, announces nothing until it is opened, then shows the tip and drops the notice', async () => {
    const user = userEvent.setup()
    render(<Dock />)
    await user.click(screen.getByRole('button', { name: 'Offer a tip' }))
    expect(echoButton('Echo, your guide, has a tip')).toBeInTheDocument()
    expect(liveText()).toBe('')

    await user.click(echoButton('Echo, your guide, has a tip'))
    expect(screen.getByRole('region', { name: 'Echo, your guide' })).toHaveTextContent('Try the date slider.')
    expect(liveText()).toBe('Try the date slider.')
    expect(echoButton()).toBeInTheDocument()
  })

  it('opens the voice guide with Talk to Echo, and closes the bubble', async () => {
    const user = userEvent.setup()
    const onTalk = vi.fn()
    render(<Dock onTalk={onTalk} />)
    await user.click(echoButton())
    await user.click(screen.getByRole('button', { name: 'Talk to Echo' }))
    expect(onTalk).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'Echo, your guide' })).not.toBeInTheDocument()
  })

  it('offers Show me around only when the tour is given', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Dock />)
    await user.click(echoButton())
    expect(screen.queryByRole('button', { name: 'Show me around' })).not.toBeInTheDocument()
    unmount()

    const onTour = vi.fn()
    render(<Dock onTour={onTour} />)
    await user.click(echoButton())
    await user.click(screen.getByRole('button', { name: 'Show me around' }))
    expect(onTour).toHaveBeenCalledTimes(1)
  })

  it('turns Echo off, remembers it, and says how to bring Echo back', async () => {
    const user = userEvent.setup()
    render(<Dock />)
    await user.click(echoButton())
    await user.click(screen.getByRole('button', { name: 'Turn Echo off' }))
    expect(screen.queryByRole('button', { name: /Echo, your guide/ })).not.toBeInTheDocument()
    expect(localStorage.getItem('earth-jukebox:mascot')).toBe('off')
    // The tip was announced a moment ago, so the announcer may hold this one back; it is the newest and is spoken when its wait ends.
    await vi.waitFor(() => expect(liveText()).toMatch(/Echo is off\. To bring Echo back, open Help and choose Turn Echo on\./), { timeout: 3000 })
  })

  it('renders nothing while the voice panel is open, and closes an open bubble when it opens', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Dock />)
    await user.click(echoButton())
    rerender(<Dock voiceOpen />)
    expect(screen.queryByRole('button', { name: /Echo, your guide/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Echo, your guide' })).not.toBeInTheDocument()
    rerender(<Dock />)
    expect(echoButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows its name on hover or focus, keeps it while hovered, and drops it on Esc', async () => {
    const user = userEvent.setup()
    render(<Dock />)
    const label = () => document.querySelector('.mascot-dock__label')
    expect(label()).toBeNull()
    await user.hover(echoButton())
    expect(label()).toHaveTextContent('Echo, your guide')
    // The label is inside the element that listens for the pointer, so moving onto the label itself keeps it (WCAG 1.4.13).
    // (user-event gives pointer events no relatedTarget, so a real move onto it cannot be simulated here.)
    expect(label()!.closest('.mascot-dock')).toContainElement(echoButton())
    await user.keyboard('{Escape}')
    expect(label()).toBeNull()
    await user.unhover(echoButton())
    expect(label()).toBeNull()
    // Focus shows it too, and it goes when focus leaves.
    act(() => echoButton().focus())
    expect(label()).not.toBeNull()
    act(() => echoButton().blur())
    expect(label()).toBeNull()
  })

  it('has no accessibility violations, closed or open', async () => {
    const user = userEvent.setup()
    const { container } = render(<Dock onTour={() => {}} />)
    await expectNoA11yViolations(container)
    await user.click(echoButton())
    await expectNoA11yViolations(container)
  })
})

describe("Echo's face", () => {
  it('is happy at rest and searches while a data set loads', () => {
    const { container, rerender } = render(<Dock />)
    expect(face(container)).toBe('happy')
    rerender(<Dock loading />)
    expect(face(container)).toBe('searching')
  })

  it('follows the voice guide: connecting searches, speaking shows the equaliser', () => {
    const { container, rerender } = render(<Dock voice="connecting" />)
    expect(face(container)).toBe('searching')
    rerender(<Dock voice="speaking" />)
    expect(face(container)).toBe('eq_active')
  })

  it('shows the equaliser while the player plays, read from the context bus', () => {
    const { container } = render(<Dock />)
    act(() => publishContext('player', { playing: true }))
    expect(face(container)).toBe('eq_active')
    act(() => publishContext('player', { playing: false }))
    expect(face(container)).toBe('happy')
  })

  it('shows an alert while an alert tip waits', async () => {
    const user = userEvent.setup()
    const { container } = render(<Dock tip={{ text: 'A storm appeared.', mood: 'alert' }} />)
    await user.click(screen.getByRole('button', { name: 'Offer a tip' }))
    expect(face(container)).toBe('alert')
  })

  it('rests after a minute without input and wakes on the next input', () => {
    vi.useFakeTimers()
    const { container } = render(<Dock />)
    act(() => { vi.advanceTimersByTime(60_000 + IDLE_CHECK_MS) })
    expect(face(container)).toBe('resting')
    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    expect(face(container)).toBe('happy')
  })
})

describe("Echo's look follows the open data set (JB04)", () => {
  const dock = (container: HTMLElement) => container.querySelector<HTMLElement>('.mascot-dock')!
  const ocean = visualizationSchema.parse(oceanManifest)
  const fixture = visualizationSchema.parse(fixtureManifest)

  it("takes the manifest's accent and trail", async () => {
    const { container } = render(<Dock visualization={ocean} />)
    expect(dock(container).style.getPropertyValue('--mascot-accent')).toBe('#00ffcc')
    expect(dock(container).style.getPropertyValue('--mascot-trail')).toBe('#00ffcc')
    expect(dock(container)).toHaveAttribute('data-trail', 'bubbles')
    await expectNoA11yViolations(container)
  })

  it('without a mascot field, takes a colour from the legend and the default trail', () => {
    const { container } = render(<Dock visualization={fixture} />)
    expect(dock(container).style.getPropertyValue('--mascot-accent')).toBe('#ff0000')
    expect(dock(container)).toHaveAttribute('data-trail', 'sparks')
  })

  it("changes when the data set changes, and keeps Echo's own colours while nothing is open", () => {
    const { container, rerender } = render(<Dock />)
    expect(dock(container).style.getPropertyValue('--mascot-accent')).toBe('')
    expect(dock(container)).not.toHaveAttribute('data-trail')
    rerender(<Dock visualization={ocean} />)
    expect(dock(container)).toHaveAttribute('data-trail', 'bubbles')
    rerender(<Dock visualization={fixture} />)
    expect(dock(container)).toHaveAttribute('data-trail', 'sparks')
    rerender(<Dock visualization={null} />)
    expect(dock(container).style.getPropertyValue('--mascot-accent')).toBe('')
  })
})
