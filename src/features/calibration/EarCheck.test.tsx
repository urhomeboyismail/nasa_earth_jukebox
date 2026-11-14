import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AnnouncerProvider } from '../../components'
import { resetCues } from '../../audio/cues'
import { readAudioPrefs, resetAudioPrefs } from '../../audio/prefs'
import { forgetKeptValues, readStoredText } from '../../hooks/useStoredValue'
import { expectNoA11yViolations } from '../../test/a11y'
import { installFakeAudioContext, FakeAudioContext } from '../../test/fakes'
import { EarCheck, EarCheckButton } from './EarCheck'
import { DETAIL_KEY } from './earCheckScore'

let audio: ReturnType<typeof installFakeAudioContext>
beforeEach(() => { localStorage.clear(); forgetKeptValues(); resetAudioPrefs(); resetCues(); audio = installFakeAudioContext() })
afterEach(() => { cleanup(); audio.uninstall() })

const oscillators = () => FakeAudioContext.instances.flatMap(context => context.oscillators)
const renderCheck = () => render(<AnnouncerProvider><EarCheck /></AnnouncerProvider>)

describe('EarCheck', () => {
  it('plays nothing until a button is pressed, then two tones for the pitch question', async () => {
    const user = userEvent.setup()
    renderCheck()
    expect(oscillators()).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Play the two tones' }))
    expect(oscillators().map(o => o.frequency.calls[0].args[0])).toEqual([330, 495])
  })

  it('cannot be answered before the tones were played', () => {
    renderCheck()
    expect(screen.getByRole('button', { name: 'The second' })).toBeDisabled()
  })

  it('goes from pitch to side, suggests a level, and Save stores the level and the stereo flip', async () => {
    const user = userEvent.setup()
    const { container } = renderCheck()
    await user.click(screen.getByRole('button', { name: 'Play the two tones' }))
    await user.click(screen.getByRole('button', { name: 'The second' }))
    await user.click(screen.getByRole('button', { name: 'Play the tone' }))
    expect(oscillators()).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Right' }))
    expect(screen.getByText('Suggested detail: Standard')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()
    expect(screen.getByText("Your left and right are swapped; we'll flip them.")).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Full' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(readStoredText(DETAIL_KEY)).toBe('full')
    expect(readAudioPrefs().swapEars).toBe(true)
    await expectNoA11yViolations(container)
  })

  it('suggests Calm after a wrong pitch answer', async () => {
    const user = userEvent.setup()
    renderCheck()
    await user.click(screen.getByRole('button', { name: 'Play the two tones' }))
    await user.click(screen.getByRole('button', { name: 'The first' }))
    await user.click(screen.getByRole('button', { name: 'Play the tone' }))
    await user.click(screen.getByRole('button', { name: 'Left' }))
    expect(screen.getByRole('radio', { name: 'Calm' })).toBeChecked()
  })
})

describe('EarCheckButton', () => {
  it('opens the check in a dialog', async () => {
    const user = userEvent.setup()
    render(<AnnouncerProvider><EarCheckButton /></AnnouncerProvider>)
    await user.click(screen.getByRole('button', { name: 'Check your ears' }))
    expect(screen.getByRole('button', { name: 'Play the two tones' })).toBeInTheDocument()
  })
})
