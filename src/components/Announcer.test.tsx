import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DUCK_LINEAR, duck, speechMs } from '../audio/duck'
import { expectNoA11yViolations } from '../test/a11y'
import { AnnouncerProvider } from './Announcer'
import { useAnnounce } from './useAnnounce'

function Button({ text }: { text: string }) {
  const announce = useAnnounce()
  return <button onClick={() => announce(text)}>Say</button>
}

beforeEach(() => {
  vi.useFakeTimers()
  duck.reset()
})
afterEach(() => {
  duck.reset()
  vi.useRealTimers()
})

describe('the announcer ducks the music', () => {
  it('begins a duck of speechMs(text) for an announcement, and the live region still gets the text', async () => {
    const text = 'The map shows warmer water near the coast.'
    const { container } = render(<AnnouncerProvider><Button text={text} /></AnnouncerProvider>)
    expect(duck.target()).toBe(1)
    act(() => screen.getByRole('button', { name: 'Say' }).click())
    expect(screen.getByRole('status')).toHaveTextContent(text)
    expect(duck.target()).toBe(DUCK_LINEAR)
    act(() => { vi.advanceTimersByTime(speechMs(text) - 1) })
    expect(duck.target()).toBe(DUCK_LINEAR)
    act(() => { vi.advanceTimersByTime(1) })
    expect(duck.target()).toBe(1)
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})
