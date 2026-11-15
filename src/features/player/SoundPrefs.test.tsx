import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { CUES_KEY } from '../../audio/cues'
import { readAudioPrefs, saveAudioPrefs } from '../../audio/prefs'
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
    // Every new sound has its words in the help.
    expect(box).toHaveAccessibleDescription(/Playing starts.*finishes/)
    expect(box).toHaveAccessibleDescription(/before date A.*date B/)
    expect(box).toHaveAccessibleDescription(/save, copy or link/)
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

describe('SoundPrefs: the music style (SN15)', () => {
  it('plays a style picked here over every data set, and "the data set\'s own sound" undoes it', async () => {
    const { container } = show(true)
    await userEvent.click(screen.getByRole('radio', { name: '8-bit arcade' }))
    expect(readAudioPrefs()).toMatchObject({ style: 'chiptune', styleEverywhere: true })
    expect(screen.getByRole('group', { name: 'Music style' })).toHaveAccessibleDescription(/plays over every data set/)
    await userEvent.click(screen.getByRole('radio', { name: "The data set's own sound" }))
    expect(readAudioPrefs()).toMatchObject({ style: null, styleEverywhere: false })
    await expectNoA11yViolations(container)
  })

  it("shows a style from the welcome as the data set's own sound, with the welcome choice named as the default", () => {
    saveAudioPrefs({ style: 'lofi', styleEverywhere: false })
    show(true)
    expect(screen.getByRole('radio', { name: "The data set's own sound" })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Lo-fi ambient' })).not.toBeChecked()
    expect(screen.getByRole('group', { name: 'Music style' })).toHaveAccessibleDescription(/your welcome choice \(Lo-fi ambient\) plays/)
  })
})
