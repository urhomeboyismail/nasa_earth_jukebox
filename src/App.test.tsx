import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import catalog from '../public/data/index.json'
import fixture from '../public/data/fixture/manifest.json'
import synthetic from '../public/data/synthetic-ocean/manifest.json'
import App from './App'
import { DataError, friendlyDataMessage } from './data'
import { addActionHandler } from './interaction/registry'
import { expectNoA11yViolations } from './test/a11y'
import { FakeRecognition } from './test/fakes'

// No sound or microphone in jsdom: the speech player and the recorder are stand-ins (V01).
vi.mock('./assistant/audio', async importOriginal => ({
  ...(await importOriginal<typeof import('./assistant/audio')>()),
  SpeechPlayer: class { onIdle = null; busy = false; resume = async () => {}; play = () => {}; flush = () => {}; close = () => {} },
  startRecorder: async () => ({ stop: () => {}, setMuted: () => {} }),
}))

// How often the guide's lazy modules were loaded, and gates that can hold the panel's (I10) and the About page's (VIS3) load.
const lazyLoads = vi.hoisted(() => ({ audio: 0, panel: 0, panelGate: Promise.resolve(), aboutGate: Promise.resolve() }))
vi.mock('./VoiceAssistant', async importOriginal => {
  lazyLoads.panel++
  await lazyLoads.panelGate
  return importOriginal()
})
vi.mock('./features/about', async importOriginal => {
  await lazyLoads.aboutGate
  return importOriginal()
})
/** The shared loader (role status) that says `label`. */
const loader = (label: string) => screen.getByText(label).closest('[role="status"]')

// The voice guide's microphone and speech player need browser audio, which jsdom has not.
vi.mock('./assistant/audio', () => {
  lazyLoads.audio++
  return {
    frameLevel: () => 0,
    startRecorder: async () => ({ stop: () => {}, setMuted: () => {} }),
    SpeechPlayer: class { busy = false; onIdle = null; resume = async () => {}; play = () => {}; flush = () => {}; close = () => {} },
  }
})

// The real analysis decodes images, which jsdom cannot do; the Player's own tests cover that path with the same mock.
vi.mock('./analysis', () => ({
  analyzeAll: async (frames: { id: string }[]) => frames.map(frame => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: 'cold' })),
}))

beforeEach(() => {
  window.location.hash = ''
  localStorage.setItem('ej_onboarding_done', 'true') // a returning visitor: Home, not the landing page
  // jsdom has no scrolling; the app scrolls to the top of each new page.
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.endsWith('/api/v1/health') ? { status: 'ok' }
      : url.endsWith('/data/index.json') ? catalog
      : url.endsWith('/data/fixture/manifest.json') ? fixture
      : url.endsWith('/data/synthetic-ocean/manifest.json') ? synthetic
      : null
    return Promise.resolve(new Response(JSON.stringify(body), { status: body ? 200 : 404 }))
  }))
})
afterEach(() => vi.unstubAllGlobals())

/** A link in the main navigation. Pages have links of their own (Learn links to Listen), so look only in the nav. */
const navLink = (name: string) => within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name })

// First in the file on purpose: a module loads once per test file, so only the first test can see it not loaded yet.
describe('First load (I10)', () => {
  it('loads the voice panel and its audio code the first time the guide is opened, not before, and says it is loading', async () => {
    Element.prototype.scrollTo ??= () => {}
    let release = () => {}
    lazyLoads.panelGate = new Promise<void>(resolve => { release = resolve })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Now playing from: Fixture ocean/)
    expect(lazyLoads).toMatchObject({ panel: 0, audio: 0 })
    expect(screen.queryByRole('region', { name: 'Voice guide' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Voice guide' }))
    expect(loader('Loading the voice guide…')).toHaveClass('ui-loading')
    expect(lazyLoads.panel).toBe(1)
    await waitFor(() => expect(lazyLoads.audio).toBe(1))

    release()
    expect(await screen.findByRole('region', { name: 'Voice guide' })).toBeInTheDocument()
    expect(screen.queryByText('Loading the voice guide…')).toBeNull()
    expect(screen.getByRole('button', { name: 'Start talking' })).toBeInTheDocument()
  })

  it('shows the demo button at once', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Play the demo' })).toBeInTheDocument()
  })

  it('shows the shared loader while a page loads for the first time (VIS3)', async () => {
    let release = () => {}
    lazyLoads.aboutGate = new Promise<void>(resolve => { release = resolve })
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(navLink('About the data'))
    expect(loader('Loading…')).toHaveClass('ui-loading')
    await expectNoA11yViolations(container)
    release()
    expect(await screen.findByRole('heading', { level: 1, name: 'About the data' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
  })
})

describe('App shell', () => {
  it('loads the first visualization and shows it on each page', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()

    await userEvent.click(navLink('Listen'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Listen' })).toHaveFocus()
    // Each page other than Home loads its code the first time it is opened, so wait for it.
    await waitFor(async () => expect(await screen.findByRole('button', { name: 'Play' })).toBeEnabled())
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveAttribute('max', '3')

    await userEvent.click(navLink('Learn the sounds'))
    expect(await screen.findByText(/Cold, Cool, Mild, Warm, Hot/)).toBeInTheDocument()
  })

  it('keeps the page in the URL hash', async () => {
    render(<App />)
    await userEvent.click(navLink('Compare two dates'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Compare two dates' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#compare')
    expect(navLink('Compare two dates')).toHaveAttribute('aria-current', 'page')
  })

  it('opens the page named by the hash on load, without moving focus', () => {
    window.location.hash = '#about'
    render(<App />)
    const heading = screen.getByRole('heading', { level: 1, name: 'About the data' })
    expect(heading).toBeInTheDocument()
    expect(heading).not.toHaveFocus()
  })

  it('opens #compare?test=1 on the Compare page', () => {
    window.location.hash = '#compare?test=1'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Compare two dates' })).toBeInTheDocument()
  })

  it('follows back and forward', async () => {
    render(<App />)
    await userEvent.click(navLink('Listen'))
    await screen.findByRole('heading', { level: 1, name: 'Listen' })
    await userEvent.click(navLink('About the data'))
    expect(await screen.findByRole('heading', { level: 1, name: 'About the data' })).toBeInTheDocument()
    window.history.back()
    expect(await screen.findByRole('heading', { level: 1, name: 'Listen' })).toHaveFocus()
    window.history.forward()
    expect(await screen.findByRole('heading', { level: 1, name: 'About the data' })).toBeInTheDocument()
  })

  it('sends an unknown hash to Home and tidies the address', async () => {
    window.location.hash = '#nope'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).toBe('#home'))
  })

  it('reacts when the hash is edited by hand', async () => {
    render(<App />)
    act(() => { window.location.hash = '#learn' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Learn the sounds' })).toBeInTheDocument()
  })

  it('says so when the data cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('', { status: 500 }))))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The list of data sets could not be loaded. Reload the page.')
  })
})

/** Developer words a listener should never read: status codes, file names, folders (I03). */
const developerWords = /HTTP|index\.json|manifest\.json|public\/data/

describe('Data errors are plain sentences; the detail goes to the console (I03)', () => {
  let consoleError: ReturnType<typeof vi.spyOn>
  beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => consoleError.mockRestore())

  it('says the list could not be loaded when it answers with HTTP 500, and logs the detail once', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('', { status: 500 }))))
    const { container } = render(<App />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The list of data sets could not be loaded.')
    expect(alert).toHaveTextContent('Reload the page')
    expect(document.body).not.toHaveTextContent(developerWords)
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(String(consoleError.mock.calls[0][0])).toContain('index.json: could not be found (HTTP 500).')
    await expectNoA11yViolations(container)
  })

  it('says the data set could not be loaded when its manifest is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(String(input).endsWith('/data/index.json')
      ? new Response(JSON.stringify(catalog), { status: 200 })
      : new Response('{ not json', { status: 200 }))))
    render(<App />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This data set could not be loaded. Choose another from the list, or reload the page.')
    expect(document.body).not.toHaveTextContent(developerWords)
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(String(consoleError.mock.calls[0][0])).toContain('fixture/manifest.json: is not valid JSON.')
  })

  it('shows the list sentence when the list is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('[]', { status: 200 }))))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The list of data sets could not be loaded. Reload the page.')
    expect(document.body).not.toHaveTextContent(developerWords)
    expect(consoleError).toHaveBeenCalledTimes(1)
  })
})

describe('friendlyDataMessage (I03)', () => {
  const generic = 'This data set could not be loaded. Choose another from the list, or reload the page.'

  it('gives the list sentence for a failure of the list itself', () => {
    expect(friendlyDataMessage(new DataError('index.json', 'could not be found (HTTP 404).'))).toBe('The list of data sets could not be loaded. Reload the page.')
  })

  it('gives the generic sentence for a data set, with no file, status or validation text', () => {
    const message = friendlyDataMessage(new DataError('fixture/manifest.json', 'frames.0.date: Invalid date (HTTP 404).'))
    expect(message).toBe(generic)
    expect(message).not.toMatch(developerWords)
  })

  it.each([['a string', 'boom'], ['null', null], ['undefined', undefined], ['a plain Error', new Error('index.json: HTTP 500')]])(
    'gives the generic sentence for %s',
    (_, error) => expect(friendlyDataMessage(error)).toBe(generic),
  )
})

describe('Choosing a data set', () => {
  const picker = () => screen.findByRole('combobox', { name: 'Data set' })

  it('offers every data set, starting on the first', async () => {
    render(<App />)
    const select = await picker()
    expect(select).toHaveValue('fixture')
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Fixture ocean', 'Synthetic ocean', 'Synthetic globe (made-up practice data)', 'Synthetic change (made-up practice data)', 'Sea surface temperature around Mauritius, 2023', 'Synthetic motion (made-up practice data)', 'Synthetic storm (made-up practice data)', 'Sea surface temperature anomaly, worldwide, 2024 to 2026'])
  })

  it('switches data set, shows it on the page, and keeps the choice in the address', async () => {
    render(<App />)
    await userEvent.selectOptions(await picker(), 'Synthetic ocean')
    expect(await screen.findByText(/Now playing from: Synthetic ocean/)).toBeInTheDocument()
    expect(window.location.hash).toBe('#home?data=synthetic-ocean')
    expect(screen.getByRole('combobox', { name: 'Data set' })).toHaveValue('synthetic-ocean')
  })

  it('keeps the choice when moving between pages', async () => {
    render(<App />)
    await userEvent.selectOptions(await picker(), 'Synthetic ocean')
    await screen.findByText(/Now playing from: Synthetic ocean/)
    expect(screen.getByRole('link', { name: 'Earth Jukebox' })).toHaveAttribute('href', '#home?data=synthetic-ocean')
    await userEvent.click(navLink('Listen'))
    expect(window.location.hash).toBe('#listen?data=synthetic-ocean')
    expect(await screen.findByRole('button', { name: 'Play' })).toBeEnabled()
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveAttribute('max', '11')
  })

  it('opens the data set named in the address', async () => {
    window.location.hash = '#about?data=synthetic-ocean'
    render(<App />)
    expect(await screen.findByText(/12 dates/)).toBeInTheDocument()
    expect(await picker()).toHaveValue('synthetic-ocean')
  })

  it('shows the first data set, and says so, when the address names one that does not exist', async () => {
    // As if the page was opened on this address: setting location.hash would queue a late hashchange event.
    window.history.replaceState(null, '', '#home?data=nope')
    render(<App />)
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    // The page's live region is also a status, so find the notice by its text and check it is announced as one.
    expect(screen.getByText('The data set “nope” was not found, so this shows “Fixture ocean” instead.').closest('[role="status"]')).not.toBeNull()
    expect(await picker()).toHaveValue('fixture')
    await waitFor(() => expect(window.location.hash).toBe('#home?data=fixture'))
  })

  it('follows back and forward between data sets', async () => {
    render(<App />)
    await userEvent.selectOptions(await picker(), 'Synthetic ocean')
    await screen.findByText(/Now playing from: Synthetic ocean/)
    window.history.back()
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    window.history.forward()
    expect(await screen.findByText(/Now playing from: Synthetic ocean/)).toBeInTheDocument()
  })

  it('says so when the chosen data set cannot be loaded, and lets you choose another', async () => {
    window.location.hash = '#home?data=synthetic-ocean'
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/data/index.json') ? catalog : url.endsWith('/data/fixture/manifest.json') ? fixture : null
      return Promise.resolve(new Response(JSON.stringify(body), { status: body ? 200 : 404 }))
    }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('This data set could not be loaded. Choose another from the list, or reload the page.')
    await userEvent.selectOptions(await picker(), 'Fixture ocean')
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not offer a choice in listening-test mode, so nobody switches data in the middle of a test', async () => {
    window.location.hash = '#compare?test=1'
    render(<App />)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(1))
    expect(screen.queryByRole('combobox', { name: 'Data set' })).toBeNull()
  })

  it('does not offer a choice when there is only one data set', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/data/index.json') ? [catalog[0]] : url.endsWith('/data/fixture/manifest.json') ? fixture : null
      return Promise.resolve(new Response(JSON.stringify(body), { status: body ? 200 : 404 }))
    }))
    render(<App />)
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Data set' })).toBeNull()
  })

  it('leaves the address clean when nothing was chosen', async () => {
    render(<App />)
    await userEvent.click(navLink('Compare two dates'))
    expect(window.location.hash).toBe('#compare')
  })
})

describe('Back to the top', () => {
  it('opens a new page at its top', async () => {
    render(<App />)
    await userEvent.click(navLink('Listen'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Listen' })).toHaveFocus()
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0 })
  })

  it('goes back to the top when the tab of the current page is tapped, without changing the page', async () => {
    window.location.hash = '#listen'
    render(<App />)
    const heading = screen.getByRole('heading', { level: 1, name: 'Listen' })
    expect(heading).not.toHaveFocus()
    await userEvent.click(navLink('Listen'))
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })
    expect(heading).toHaveFocus()
    expect(window.location.hash).toBe('#listen')
  })

  it('does the same for the wordmark on Home', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('link', { name: 'Earth Jukebox' }))
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toHaveFocus()
  })
})

describe('App shell chrome (T116)', () => {
  it('names each nav link by its full title, shows a short label, and marks only the current page', () => {
    render(<App />)
    const compare = navLink('Compare two dates')
    expect(compare).toHaveAttribute('href', '#compare')
    expect(compare).toHaveTextContent('Compare')
    expect(navLink('Home')).toHaveAttribute('aria-current', 'page')
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link').filter(link => link.hasAttribute('aria-current'))).toHaveLength(1)
  })

  it('links the wordmark to Home', () => {
    window.location.hash = '#about'
    render(<App />)
    expect(screen.getByRole('link', { name: 'Earth Jukebox' })).toHaveAttribute('href', '#home')
  })

  it('has a skip link that moves focus to the page heading without changing the page', async () => {
    window.location.hash = '#learn'
    render(<App />)
    await userEvent.tab()
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    expect(skip).toHaveFocus()
    await userEvent.click(skip)
    expect(screen.getByRole('heading', { level: 1, name: 'Learn the sounds' })).toHaveFocus()
    expect(window.location.hash).toBe('#learn')
  })

  it('names the browser tab after the page', async () => {
    render(<App />)
    expect(document.title).toBe('Home · Earth Jukebox')
    await userEvent.click(navLink('About the data'))
    await waitFor(() => expect(document.title).toBe('About the data · Earth Jukebox'))
  })

  it('returns focus to the voice guide button when the guide closes', async () => {
    // jsdom has no Element.scrollTo, which the panel uses to keep the conversation scrolled down.
    Element.prototype.scrollTo ??= () => {}
    render(<App />)
    const toggle = screen.getByRole('button', { name: 'Voice guide' })
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    // The panel loads the first time it is opened (I10).
    await userEvent.click(await screen.findByRole('button', { name: 'Close voice guide' }))
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveFocus()
  })
})

describe('Announcements reach the live region on every page (I01)', () => {
  afterEach(() => window.localStorage.clear())

  it('says so when the help button turns Echo off', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Help from Echo' }))
    await user.click(screen.getByRole('button', { name: 'Turn Echo off' }))
    expect(screen.getByText('Echo is off.', { selector: '[role="status"]' })).toBeInTheDocument()
  })

  it('opens a first visit on the landing page, without the nav or the data cards', async () => {
    localStorage.clear()
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Skip the welcome' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#welcome')
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
    expect(screen.queryByText('The crate')).toBeNull()
    expect(document.title).toBe('Welcome · Earth Jukebox')
  })

  it('goes straight to Home for a returning visitor, and Replay welcome reopens the landing page', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip the welcome' })).toBeNull()
    window.location.hash = '#welcome'
    await user.click(await screen.findByRole('button', { name: 'Skip the welcome' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toHaveFocus()
    expect(window.location.hash).toBe('#home')
  })

  it('says so when the welcome is skipped', async () => {
    const user = userEvent.setup()
    localStorage.clear()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Skip the welcome' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(screen.getByText('Welcome skipped.', { selector: '[role="status"]' })).toBeInTheDocument()
  })
})

describe('The voice guide moves the app without moving focus (V01)', () => {
  class FakeSocket {
    static OPEN = 1
    static instances: FakeSocket[] = []
    readyState = 1
    binaryType = ''
    onopen: (() => void) | null = null
    onmessage: ((event: { data: unknown }) => unknown) | null = null
    onerror: (() => void) | null = null
    onclose: (() => void) | null = null
    constructor() { FakeSocket.instances.push(this) }
    send() {}
    close() {}
  }
  beforeEach(() => {
    Element.prototype.scrollTo ??= () => {}
    FakeSocket.instances = []
    vi.stubGlobal('WebSocket', FakeSocket)
    window.localStorage.clear() // each case answers the microphone question afresh (V02)
    window.localStorage.setItem('ej_onboarding_done', 'true') // a returning visitor: Home, not the landing page
  })

  const toggle = () => screen.getByRole('button', { name: 'Voice guide' })
  const server = (message: Record<string, unknown>) =>
    act(async () => { await FakeSocket.instances[FakeSocket.instances.length - 1].onmessage?.({ data: JSON.stringify(message) }) })
  async function talk() {
    const user = userEvent.setup()
    render(<App />)
    await user.click(toggle())
    await user.click(screen.getByRole('button', { name: 'Start talking' }))
    await user.click(screen.getByRole('button', { name: 'Allow microphone' })) // V02: the consent card comes first
    act(() => FakeSocket.instances[0].onopen?.())
    await server({ type: 'ready' })
    return user
  }

  it('keeps focus where it was when the guide opens a page, says so, and lets the listener undo it', async () => {
    const user = await talk()
    const input = screen.getByRole('textbox', { name: 'Type a question instead' })
    await user.click(input)
    await server({ type: 'action', action: 'navigate', page: 'listen' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Listen' })).not.toHaveFocus()
    expect(input).toHaveFocus()
    // The panel's own live region (the app's announcer is another one).
    expect(screen.getByRole('region', { name: 'Voice guide' }).querySelector('[aria-live="polite"]')).toHaveTextContent('Opened Listen')

    await user.click(screen.getByRole('button', { name: 'Undo: Opened Listen' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).not.toHaveFocus()
    // The Undo button is gone, so focus goes to the panel title, not to the page and not lost.
    expect(screen.getByRole('heading', { name: 'Voice guide' })).toHaveFocus()
    expect(within(screen.getByRole('list', { name: 'Echo did' })).getByText('Undid: Opened Listen')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull()
  })

  it("still moves focus to the heading for the listener's own navigation afterwards", async () => {
    const user = await talk()
    await server({ type: 'action', action: 'navigate', page: 'listen' })
    await screen.findByRole('heading', { level: 1, name: 'Listen' })
    await user.click(navLink('About the data'))
    expect(await screen.findByRole('heading', { level: 1, name: 'About the data' })).toHaveFocus()
  })

  it('hands a point from the guide to the dispatcher, as the E key does (IX09)', async () => {
    const pointed = vi.fn()
    const remove = addActionHandler('point', pointed)
    await talk()
    await server({ type: 'action', action: 'point', target: 'centre' })
    expect(pointed).toHaveBeenCalledWith({ type: 'point', target: 'centre' })
    await server({ type: 'action', action: 'point', target: 'nowhere' }) // not on the allow-list: dropped
    expect(pointed).toHaveBeenCalledTimes(1)
    remove()
  })

  it('does not leave a stale flag when the guide "opens" the page already showing', async () => {
    const user = await talk()
    await server({ type: 'action', action: 'navigate', page: 'home' })
    await user.click(navLink('Listen'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Listen' })).toHaveFocus()
  })

  it('opens and closes the guide with Alt+E, and names the shortcut on the button', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(toggle()).toHaveAttribute('aria-keyshortcuts', 'Alt+E')
    await user.keyboard('{Alt>}e{/Alt}')
    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('{Escape}') // focus is in the panel
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    await user.keyboard('{Alt>}e{/Alt}')
    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
    screen.getByRole('heading', { name: 'Voice guide' }).blur()
    await user.keyboard('{Alt>}e{/Alt}')
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    expect(toggle()).toHaveFocus()
  })

  it('ignores Alt+E typed into a text field', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(toggle())
    await user.click(screen.getByRole('button', { name: 'Start talking' }))
    await user.click(screen.getByRole('button', { name: 'Allow microphone' }))
    act(() => FakeSocket.instances[0].onopen?.())
    await server({ type: 'ready' })
    await user.click(screen.getByRole('textbox', { name: 'Type a question instead' }))
    await user.keyboard('{Alt>}e{/Alt}')
    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('"Hey Echo" opens the guide hands-free', () => {
  class WakeSocket {
    static OPEN = 1
    static instances: WakeSocket[] = []
    readyState = 1
    binaryType = ''
    onopen: (() => void) | null = null
    onmessage: ((event: { data: unknown }) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null
    sent: unknown[] = []
    constructor() { WakeSocket.instances.push(this) }
    send(data: unknown) { this.sent.push(data) }
    close() {}
  }
  beforeEach(() => {
    Element.prototype.scrollTo ??= () => {}
    FakeRecognition.instances = []
    WakeSocket.instances = []
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    vi.stubGlobal('WebSocket', WakeSocket)
    localStorage.setItem('earth-jukebox:mic-consent', 'text')
    localStorage.setItem('ej_onboarding_done', 'true')
  })
  afterEach(() => localStorage.clear())

  it('is off until turned on, and says nothing in the header', async () => {
    render(<App />)
    await screen.findByText(/Now playing from: Fixture ocean/)
    expect(FakeRecognition.instances).toHaveLength(0)
    expect(screen.queryByText(/Listening for “Hey Echo”/)).toBeNull()
  })

  it('when on, the header says it is listening; the phrase opens the guide, connects, and asks the question said after it', async () => {
    localStorage.setItem('earth-jukebox:wake-word', 'on')
    render(<App />)
    await screen.findByText(/Now playing from: Fixture ocean/)
    expect(screen.getByText('Listening for “Hey Echo”')).toBeInTheDocument()
    const recognition = FakeRecognition.instances.at(-1)!
    act(() => recognition.say('hey echo which date was warmest'))

    expect(await screen.findByRole('region', { name: 'Voice guide' })).toBeInTheDocument()
    await waitFor(() => expect(WakeSocket.instances).toHaveLength(1))
    expect(recognition.aborted).toBe(true) // The guide has the microphone now.
    const socket = WakeSocket.instances[0]
    act(() => socket.onopen?.())
    act(() => socket.onmessage?.({ data: JSON.stringify({ type: 'ready' }) }))
    const sentTexts = () => socket.sent.filter((item): item is string => typeof item === 'string').map(item => JSON.parse(item))
    await waitFor(() => expect(sentTexts()).toContainEqual({ type: 'text', text: 'which date was warmest' }))
    expect(screen.queryByText('Listening for “Hey Echo”')).toBeNull() // Paused during the conversation.
  })

  it('"Turn off" in the header stops listening', async () => {
    localStorage.setItem('earth-jukebox:wake-word', 'on')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText(/Now playing from: Fixture ocean/)
    const recognition = FakeRecognition.instances.at(-1)!
    await user.click(screen.getByRole('button', { name: 'Turn off “Hey Echo”' }))
    expect(recognition.aborted).toBe(true)
    expect(localStorage.getItem('earth-jukebox:wake-word')).toBeNull()
  })
})
