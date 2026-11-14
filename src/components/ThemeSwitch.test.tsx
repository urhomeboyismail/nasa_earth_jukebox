import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetKeptValues } from '../hooks/useStoredValue'
import { applyStoredTheme, THEME_KEY } from '../hooks/useTheme'
import { expectNoA11yViolations } from '../test/a11y'
import { AnnouncerContext } from './announcerContext'
import { ThemeSwitch } from './ThemeSwitch'

const announced: string[] = []
const show = () => render(<AnnouncerContext.Provider value={text => { announced.push(text) }}><ThemeSwitch /></AnnouncerContext.Provider>)

beforeEach(() => { announced.length = 0; localStorage.clear(); forgetKeptValues(); delete document.documentElement.dataset.theme })
afterEach(() => vi.restoreAllMocks())

describe('ThemeSwitch', () => {
  it('starts at Night, not pressed, and puts the theme on <html>', () => {
    show()
    expect(screen.getByRole('button', { name: 'Day theme' })).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.dataset.theme).toBe('night')
  })

  it('switches to Day and back, keeps the choice, and announces each change', async () => {
    const { container } = show()
    const button = screen.getByRole('button', { name: 'Day theme' })
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.dataset.theme).toBe('day')
    expect(localStorage.getItem(THEME_KEY)).toBe('day')
    expect(announced).toEqual(['Day theme'])
    await expectNoA11yViolations(container)
    await userEvent.click(button)
    expect(document.documentElement.dataset.theme).toBe('night')
    expect(announced).toEqual(['Day theme', 'Night theme'])
  })

  it('opens on the stored choice, and applyStoredTheme sets it before anything renders', () => {
    localStorage.setItem(THEME_KEY, 'day')
    applyStoredTheme()
    expect(document.documentElement.dataset.theme).toBe('day')
    show()
    expect(screen.getByRole('button', { name: 'Day theme' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('treats anything unknown in storage as Night', () => {
    localStorage.setItem(THEME_KEY, 'purple')
    applyStoredTheme()
    expect(document.documentElement.dataset.theme).toBe('night')
  })

  it('still switches for this visit when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Day theme' }))
    expect(document.documentElement.dataset.theme).toBe('day')
    expect(screen.getByRole('button', { name: 'Day theme' })).toHaveAttribute('aria-pressed', 'true')
  })
})
