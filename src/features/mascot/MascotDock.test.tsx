import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixtureManifest from '../../../public/data/fixture/manifest.json'
import oceanManifest from '../../../public/data/synthetic-ocean/manifest.json'
import { publishContext } from '../../assistant/context'
import { publishDataEvents } from './dataEvents'
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

type Props = Partial<{ page: 'home' | 'listen'; loading: boolean; voice: AssistantStatus; voiceOpen: boolean; line: string; onTour: () => void; onTalk: () => void; tip: Tip; visualization: Visualization | null }>

function Dock({ page = 'listen', loading = false, voice = 'idle', voiceOpen = false, line, onTour, onTalk = () => {}, tip = { text: 'Try the date slider.' }, visualization }: Props) {
  return (
    <AnnouncerProvider>
      <MascotGuideProvider>
        <OfferButton tip={tip} />
        <MascotDock page={page} loading={loading} voice={voice} voiceOpen={voiceOpen} line={line} onTalk={onTalk} onTour={onTour} visualization={visualization} />
      </MascotGuideProvider>
    </AnnouncerProvider>
  )
}

const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''
const echoButton = (name = 'Echo, your guide') => screen.getByRole('button', { name })
const robot = (container: HTMLElement) => container.querySelector('robot-companion')
const face = (container: HTMLElement) => robot(container)?.getAttribute('data-expression')

beforeEach(() => {
  setMascotOn(true)
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  setMascotOn(true)
  publishContext('player', null)
  publishContext('explore', null)
})

describe('the dock', () => {
  it('shows the alert symbol when the music has a notable event, keeps the sentence for the bubble, and says nothing aloud', async () => {
    const user = userEvent.setup()
    const { container } = render(<Dock />)
    act(() => publishDataEvents([{ kind: 'appeared', sentence: 'A new warm area appeared in the north-east.' }]))
    expect(face(container)).toBe('alert')
    expect(liveText()).toBe('')
    await user.click(echoButton('Echo, your guide, has a tip'))
    expect(screen.getByRole('region', { name: 'Echo, your guide' })).toHaveTextContent('A new warm area appeared in the north-east.')
    await expectNoA11yViolations(container)
  })

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

  it('offers Show me around, starts the tour, and tells the page', async () => {
    const user = userEvent.setup()
    const onTour = vi.fn()
    render(<Dock onTour={onTour} />)
    await user.click(echoButton())
    await user.click(screen.getByRole('button', { name: 'Show me around' }))
    expect(onTour).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('region', { name: 'Guided tour' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop tour' }))
  })

  it('offers Replay welcome, which opens the landing page and closes the bubble', async () => {
    const user = userEvent.setup()
    render(<Dock />)
    await user.click(echoButton())
    await user.click(screen.getByRole('button', { name: 'Replay welcome' }))
    expect(window.location.hash).toBe('#welcome')
    expect(screen.queryByRole('region', { name: 'Echo, your guide' })).not.toBeInTheDocument()
    window.location.hash = ''
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

  it('keeps only the robot while the voice panel is open, the same one, and closes an open bubble when it opens', async () => {
    const user = userEvent.setup()
    const { container, rerender } = render(<Dock />)
    const before = robot(container)
    await user.click(echoButton())
    rerender(<Dock voiceOpen />)
    expect(screen.queryByRole('button', { name: /Echo, your guide/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Echo, your guide' })).not.toBeInTheDocument()
    expect(container.querySelector('.mascot-dock')).toHaveClass('mascot-dock--beside-voice')
    // Not remounted: its 3D scene is set up once.
    expect(robot(container)).toBe(before)
    rerender(<Dock />)
    expect(echoButton()).toHaveAttribute('aria-expanded', 'false')
    expect(robot(container)).toBe(before)
  })

  it('closes on Esc while focus is elsewhere on the page (as after a click on the robot)', async () => {
    const user = userEvent.setup()
    render(<Dock />)
    await user.click(echoButton())
    act(() => echoButton().blur())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Echo, your guide' })).not.toBeInTheDocument()
  })

  it('closes the bubble when the page changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Dock page="listen" />)
    await user.click(echoButton())
    rerender(<Dock page="home" />)
    expect(screen.queryByRole('region', { name: 'Echo, your guide' })).not.toBeInTheDocument()
    expect(echoButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows its name on hover, keeps it while hovered, drops it on Esc, and shows the named button on focus', async () => {
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
    // Focus shows the button itself, which carries the name, so the label does not repeat it.
    act(() => echoButton().focus())
    expect(label()).toBeNull()
    expect(echoButton()).toHaveTextContent('Echo, your guide')
  })

  it('has no accessibility violations, closed or open', async () => {
    const user = userEvent.setup()
    const { container } = render(<Dock onTour={() => {}} />)
    await expectNoA11yViolations(container)
    await user.click(echoButton())
    await expectNoA11yViolations(container)
  })
})

describe("Echo's robot (JB08)", () => {
  it('is drawn by the 3D robot, hidden from screen readers, under the button, and never makes a sound', () => {
    const contexts = vi.fn()
    vi.stubGlobal('AudioContext', contexts)
    const { container } = render(<Dock />)
    expect(robot(container)).toHaveAttribute('aria-hidden', 'true')
    expect(robot(container)).toHaveAttribute('data-pose', 'idle')
    expect(robot(container)?.closest('.mascot-dock')).toContainElement(echoButton())
    expect(contexts).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("takes its pose from the voice guide, and mouths the guide's line only while the voice panel is open", () => {
    const { container, rerender } = render(<Dock voice="speaking" line="Hello there." />)
    expect(robot(container)).toHaveAttribute('data-pose', 'talking')
    expect(robot(container)).toHaveAttribute('data-say', '')
    rerender(<Dock voice="speaking" voiceOpen line="Hello there." />)
    expect(robot(container)).toHaveAttribute('data-say', 'Hello there.')
    rerender(<Dock voice="listening" voiceOpen line="" />)
    expect(robot(container)).toHaveAttribute('data-pose', 'listening')
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

describe('Echo mirrors the sound map (JB07)', () => {
  const exploring = (position: number, here = '') => ({ exploring: true, value: position * 30, position, here })

  it('searches while the map is explored and goes back to its usual face after', () => {
    const { container } = render(<Dock />)
    expect(face(container)).toBe('happy')
    act(() => publishContext('explore', exploring(0.5)))
    expect(face(container)).toBe('searching')
    act(() => publishContext('explore', { exploring: false, value: null, position: null, here: '' }))
    expect(face(container)).toBe('happy')
    act(() => publishContext('explore', exploring(0.5)))
    act(() => publishContext('explore', null))
    expect(face(container)).toBe('happy')
  })

  it('knows the map is being explored when it mounts after that began', () => {
    publishContext('explore', exploring(0.2))
    const { container } = render(<Dock />)
    expect(face(container)).toBe('searching')
  })

  it("shows the latest What's here sentence when the bubble is opened, and the usual tip when it is not exploring", async () => {
    const user = userEvent.setup()
    render(<Dock />)
    act(() => publishContext('explore', exploring(0.5, 'Warm water, 21 °C, near the west edge.')))
    await user.click(echoButton())
    expect(screen.getByRole('region', { name: 'Echo, your guide' })).toHaveTextContent('Warm water, 21 °C, near the west edge.')
    await user.click(echoButton())
    act(() => publishContext('explore', null))
    await user.click(echoButton())
    expect(screen.getByRole('region', { name: 'Echo, your guide' })).toHaveTextContent(TIPS.listen)
  })

  it('makes no sound or speech of its own when the cursor moves', () => {
    render(<Dock />)
    const before = liveText()
    act(() => publishContext('explore', exploring(0.3)))
    act(() => publishContext('explore', exploring(0.9)))
    expect(liveText()).toBe(before)
  })
})
