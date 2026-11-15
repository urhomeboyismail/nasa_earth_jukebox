import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import { installFakeAudioContext } from '../../test/fakes'
import { LiveAnswer } from './LiveAnswer'
import type { MascotAnswer } from './mascotQuery'

// The pictures have their own tests (LiveImages.test.tsx); here a marker that shows what they were given.
vi.mock('./LiveImages', () => ({
  LiveImages: ({ pictures }: { pictures: { images: unknown[] } }) => <p>{pictures.images.length} pictures</p>,
}))

const url = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/57,-21,58,-20.png?item=a'
const full: MascotAnswer = {
  reply: 'I found 2 days of sea surface temperature.',
  theme: 'ocean',
  audio: { base_bpm: 100, tracks: [{ instrument: 'marimba', pitch_range: [52, 76], volume_curve: [0.15, 1] }] },
  localId: null,
  series: { metric: 'Sea surface temperature', unit: '°C', times: ['2026-06-01', '2026-06-02'], values: [24.1, 24.6] },
  pictures: { images: [{ date: '2026-06-01', url }, { date: '2026-06-02', url }], legend: { kind: 'picture' }, area: [57, -21, 58, -20] },
}

let audio: ReturnType<typeof installFakeAudioContext>
beforeEach(() => { audio = installFakeAudioContext() })
afterEach(() => audio.uninstall())

describe('LiveAnswer (G13)', () => {
  it('shows the reply, the player, the numbers and the pictures of a full answer', async () => {
    const { container } = render(<LiveAnswer answer={full} />)
    const section = screen.getByRole('region', { name: "Echo's answer" })
    expect(section).toHaveTextContent(full.reply)
    expect(within(section).getByRole('region', { name: 'Jukebox player' })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Play' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('Show the numbers'))
    expect(screen.getByRole('table')).toHaveTextContent('24.6')
    expect(section).toHaveTextContent('2 pictures')
    await expectNoA11yViolations(container)
  })

  it('shows a bare reply when there is nothing else, and links to an app data set', async () => {
    const { container, rerender } = render(<LiveAnswer answer={{ ...full, audio: null, series: null, pictures: null }} />)
    const section = screen.getByRole('region', { name: "Echo's answer" })
    expect(section).toHaveTextContent(full.reply)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText(/pictures$/)).toBeNull()
    await expectNoA11yViolations(container)

    rerender(<LiveAnswer answer={{ ...full, audio: null, series: null, pictures: null, localId: 'fixture' }} />)
    expect(screen.getByRole('link', { name: 'Open it in the app' })).toHaveAttribute('href', '#listen?data=fixture')
  })
})
