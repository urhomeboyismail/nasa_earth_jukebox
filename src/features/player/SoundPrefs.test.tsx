import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { CUES_KEY } from '../../audio/cues'
import { AnnouncerProvider } from '../../components'
import { forgetKeptValues } from '../../hooks/useStoredValue'
import { expectNoA11yViolations } from '../../test/a11y'
import { SoundPrefs } from './SoundPrefs'

beforeEach(() => { localStorage.clear(); forgetKeptValues() })

const show = (cues: boolean) => render(<AnnouncerProvider><SoundPrefs ownPreset="major" cues={cues} /></AnnouncerProvider>)

describe('SoundPrefs: interface sounds', () => {
  it('has an "Interface sounds" switch, on at first, that keeps the choice', async () => {
    const { container } = show(true)
    const box = screen.getByRole('checkbox', { name: 'Interface sounds' })
    expect(box).toBeChecked()
    expect(box).toHaveAccessibleDescription(/never carry data/)
    await userEvent.click(box)
    expect(box).not.toBeChecked()
    expect(localStorage.getItem(CUES_KEY)).toBe('off')
    await expectNoA11yViolations(container)
  })

  it('leaves the switch out where it is not asked for (the welcome)', () => {
    show(false)
    expect(screen.queryByRole('checkbox', { name: 'Interface sounds' })).toBeNull()
  })
})
