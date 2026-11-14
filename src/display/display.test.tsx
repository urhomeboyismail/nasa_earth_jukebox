import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnouncerProvider } from '../components'
import { expectNoA11yViolations } from '../test/a11y'
import { DisplayButton, DisplaySettingsProvider } from './DisplaySettings'
import { DISPLAY_STORAGE_KEY } from './flags'

const wrapper = ({ children }: { children: ReactNode }) => (
  <AnnouncerProvider><DisplaySettingsProvider>{children}</DisplaySettingsProvider></AnnouncerProvider>
)
const root = document.documentElement
const CLASSES = ['display-readable', 'display-high-contrast', 'display-patterns', 'display-hide-crate']
const THREE = ['display-readable', 'display-high-contrast', 'display-patterns']
const classes = () => CLASSES.filter(name => root.classList.contains(name))
const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''

async function open() {
  const user = userEvent.setup()
  const view = render(<DisplayButton />, { wrapper })
  await user.click(screen.getByRole('button', { name: 'Display' }))
  return { user, ...view }
}
const sw = (name: string) => screen.getByRole('switch', { name })

function matchMedia(more: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: more && query.includes('prefers-contrast: more'), media: query, addEventListener() {}, removeEventListener() {} }))
}

beforeEach(() => { localStorage.clear(); matchMedia(false) })
afterEach(() => { CLASSES.forEach(name => root.classList.remove(name)); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('display settings', () => {
  it('starts with everything off', async () => {
    await open()
    for (const name of ['Easier reading font', 'High contrast', 'Colour-vision patterns', 'Hide the Crate on Home']) expect(sw(name)).not.toBeChecked()
    expect(classes()).toEqual([])
  })

  it.each([
    ['Easier reading font', 'display-readable'],
    ['High contrast', 'display-high-contrast'],
    ['Colour-vision patterns', 'display-patterns'],
  ])('%s alone sets only its class, and says so', async (name, className) => {
    const { user } = await open()
    await user.click(sw(name))
    expect(classes()).toEqual([className])
    expect(liveText()).toBe(`${name} on.`)
    await user.click(sw(name))
    expect(classes()).toEqual([])
    expect(liveText()).toBe(`${name} off.`)
  })

  it.each([
    [['Easier reading font', 'High contrast'], ['display-readable', 'display-high-contrast']],
    [['Easier reading font', 'Colour-vision patterns'], ['display-readable', 'display-patterns']],
    [['High contrast', 'Colour-vision patterns'], ['display-high-contrast', 'display-patterns']],
    [['Easier reading font', 'High contrast', 'Colour-vision patterns'], THREE],
  ])('combines %j', async (names, expected) => {
    const { user } = await open()
    for (const name of names) await user.click(sw(name))
    expect([...classes()].sort()).toEqual([...expected].sort())
  })

  it('remembers the choice after a reload', async () => {
    const first = await open()
    await first.user.click(sw('High contrast'))
    first.unmount()
    CLASSES.forEach(name => root.classList.remove(name))
    await open()
    expect(sw('High contrast')).toBeChecked()
    expect(classes()).toEqual(['display-high-contrast'])
  })

  it('still works for the visit when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const { user } = await open()
    await user.click(sw('Colour-vision patterns'))
    expect(sw('Colour-vision patterns')).toBeChecked()
    expect(classes()).toEqual(['display-patterns'])
  })

  it('ignores saved text of the wrong shape', async () => {
    localStorage.setItem(DISPLAY_STORAGE_KEY, '{"readable":"yes"}')
    await open()
    expect(sw('Easier reading font')).not.toBeChecked()
  })

  it('turns high contrast on when the system asks for more contrast and nothing is saved', async () => {
    matchMedia(true)
    await open()
    expect(sw('High contrast')).toBeChecked()
    expect(classes()).toEqual(['display-high-contrast'])
  })

  it('lets a saved "off" win over the system', async () => {
    matchMedia(true)
    localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify({ highContrast: false }))
    await open()
    expect(sw('High contrast')).not.toBeChecked()
  })

  it('"Reset display" clears every switch and the saved choice', async () => {
    const { user } = await open()
    await user.click(sw('Easier reading font'))
    await user.click(sw('Colour-vision patterns'))
    await user.click(screen.getByRole('button', { name: 'Reset display' }))
    expect(classes()).toEqual([])
    expect(localStorage.getItem(DISPLAY_STORAGE_KEY)).toBeNull()
    expect(liveText()).toBe('Display settings reset.')
  })

  it('opens by keyboard and closes with Escape, giving focus back to the button', async () => {
    const user = userEvent.setup()
    render(<DisplayButton />, { wrapper })
    const button = screen.getByRole('button', { name: 'Display' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    button.focus()
    await user.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    await user.tab()
    expect(sw('Easier reading font')).toHaveFocus()
    await user.keyboard(' ')
    expect(classes()).toEqual(['display-readable'])
    await user.keyboard('{Escape}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
  })

  it('has no accessibility violations with every switch off and on', async () => {
    const { user, container } = await open()
    await expectNoA11yViolations(container)
    for (const name of ['Easier reading font', 'High contrast', 'Colour-vision patterns']) await user.click(sw(name))
    await expectNoA11yViolations(container)
  })
})

describe('the Atkinson Hyperlegible font files', () => {
  const files = ['AtkinsonHyperlegible-Regular.woff2', 'AtkinsonHyperlegible-Bold.woff2']
  const path = (name: string) => `public/fonts/${name}`

  it('are WOFF2 files, at most 100 KB together, with their licence beside them', () => {
    let total = 0
    for (const name of files) {
      const bytes = readFileSync(path(name))
      expect(String.fromCharCode(...bytes.subarray(0, 4)), name).toBe('wOF2')
      total += bytes.length
    }
    expect(total).toBeLessThanOrEqual(100 * 1024)
    expect(readFileSync(path('OFL-AtkinsonHyperlegible.txt'), 'utf8')).toContain('SIL Open Font License')
  })

  it('are recorded in docs/data-sources.md with their source, version and SHA-256', async () => {
    const notes = readFileSync('docs/data-sources.md', 'utf8')
    expect(notes).toContain('@fontsource/atkinson-hyperlegible')
    expect(notes).toContain('version 5.3.0')
    // jsdom has no crypto.subtle, and src/analysis/node.d.ts types only the node modules already used.
    const { createHash } = await import('node:crypto')
    for (const name of files) expect(notes).toContain(String(createHash('sha256').update(readFileSync(path(name))).digest('hex')))
  })
})
