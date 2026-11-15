import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import catalog from '../../../public/data/index.json'
import fixture from '../../../public/data/fixture/manifest.json'
import mauritius from '../../../public/data/mur-sst-mauritius/manifest.json'
import App from '../../App'
import { pages } from '../../pages'
import { expectNoA11yViolations } from '../../test/a11y'
import { DemoControl } from '../demo/DemoControl'
import { HelpButton } from './HelpButton'
import { readMascotOn, setMascotOn } from './mascotSetting'
import { TIPS } from './tips'

// The real analysis decodes images, which jsdom cannot do; the sound engine needs the audio hardware jsdom lacks.
vi.mock('../../analysis', () => ({
  analyzeAll: async (frames: { id: string }[]) => frames.map(frame => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: 'cold' })),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => ({ unlock: async () => {}, setVolume: () => {}, setStyle: () => {}, setSpatial: () => {}, stop: () => {}, playSequence: () => {} }) }))

beforeEach(() => {
  localStorage.clear()
  setMascotOn(true)
  localStorage.setItem('ej_onboarding_done', 'true') // a returning visitor: Home, not the landing page
  window.location.hash = ''
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.endsWith('/data/index.json') ? catalog
      : url.endsWith('/data/fixture/manifest.json') ? fixture
      : url.endsWith('/data/mur-sst-mauritius/manifest.json') ? mauritius
      : null
    return Promise.resolve(new Response(JSON.stringify(body), { status: body ? 200 : 404 }))
  }))
})
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); window.location.hash = '' })

describe('tips', () => {
  it('has one tip for every page, and none names a data set', () => {
    expect(Object.keys(TIPS).sort()).toEqual(pages.map(page => page.id).sort())
    for (const tip of Object.values(TIPS)) expect(tip).not.toMatch(/warm|cool|ocean|sea|ice|temperature/i)
  })
})

describe('Help from Echo', () => {
  it('opens by keyboard, shows the tip for its page and closes on Escape with focus back on the button', async () => {
    const user = userEvent.setup()
    const { container } = render(<HelpButton page="listen" />)
    const button = screen.getByRole('button', { name: 'Help from Echo' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    button.focus()
    await user.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(TIPS.listen)).toBeInTheDocument()
    await expectNoA11yViolations(container)
    await user.keyboard('{Escape}')
    expect(screen.queryByText(TIPS.listen)).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it.each(pages.map(page => page.id))('gives the %s page its own tip', async id => {
    const user = userEvent.setup()
    render(<HelpButton page={id} />)
    await user.click(screen.getByRole('button', { name: 'Help from Echo' }))
    expect(screen.getByText(TIPS[id])).toBeInTheDocument()
  })

  it('opens the welcome landing page again', async () => {
    const user = userEvent.setup()
    setMascotOn(false)
    render(<HelpButton page="about" />)
    await user.click(screen.getByRole('button', { name: 'Help' }))
    await user.click(screen.getByRole('button', { name: 'Show the welcome again' }))
    expect(readMascotOn()).toBe(true)
    expect(window.location.hash).toBe('#welcome')
  })

  it('turns the mascot off and on, and keeps the help button either way', async () => {
    const user = userEvent.setup()
    render(<HelpButton page="home" />)
    await user.click(screen.getByRole('button', { name: 'Help from Echo' }))
    await user.click(screen.getByRole('button', { name: 'Turn Echo off' }))
    expect(readMascotOn()).toBe(false)
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Turn Echo on' }))
    expect(readMascotOn()).toBe(true)
    expect(screen.getByRole('button', { name: 'Help from Echo' })).toBeInTheDocument()
  })

  it('keeps the mascot setting when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
    setMascotOn(false)
    expect(readMascotOn()).toBe(false)
    setMascotOn(true)
    expect(readMascotOn()).toBe(true)
    vi.restoreAllMocks()
  })
})

describe('the demo host', () => {
  async function runAndStop() {
    const user = userEvent.setup()
    const view = render(<DemoControl />)
    await user.click(screen.getByRole('button', { name: 'Play the demo' }))
    await user.click(screen.getByRole('button', { name: 'Stop the demo' }))
    await waitFor(() => expect(document.querySelector('.demo__caption')?.textContent).toBe('The demo was stopped.'))
    return view
  }

  it('shows the mascot beside the caption, as decoration, and none while there is no caption', async () => {
    const view = render(<DemoControl />)
    expect(view.container.querySelector('.demo__mascot')).toBeNull()
    view.unmount()
    const { container } = await runAndStop()
    const face = container.querySelector('.demo__mascot')
    expect(face).toHaveAttribute('alt', '')
    expect(screen.getByRole('button', { name: 'Play the demo' })).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('shows no face when the mascot is off, and the caption is the same', async () => {
    setMascotOn(false)
    const { container } = await runAndStop()
    expect(container.querySelector('.demo__mascot')).toBeNull()
  })
})

describe('in the app', () => {
  it('puts the help button in the same place on every page: right after the page title', async () => {
    const user = userEvent.setup()
    render(<App />)
    for (const page of pages) {
      const link = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: page.title })
      await user.click(link)
      const heading = await screen.findByRole('heading', { level: 1, name: page.title })
      const button = screen.getByRole('button', { name: 'Help from Echo' })
      // Same parent as the title, and the next element after it.
      expect(heading.nextElementSibling).toBe(button.closest('.help'))
    }
  })

  it('closes the panel when the page changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Help from Echo' }))
    expect(screen.getByText(TIPS.home)).toBeInTheDocument()
    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'About the data' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'About the data' })).toBeInTheDocument()
    expect(screen.queryByText(TIPS.home)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Help from Echo' })).toHaveAttribute('aria-expanded', 'false')
  })
})
