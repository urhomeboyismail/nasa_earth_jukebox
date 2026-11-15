import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import { ComingNext } from './ComingNext'

const queue = [
  { id: '1', title: 'Pretend sea ice', summary: 'Made-up ice.', family: 'ocean', url: 'https://example.org/1', released: '2026-01-01', soundIdea: 'A thinning chord.' },
  { id: '2', title: 'Pretend storm', summary: 'Made-up storm.', family: 'atmosphere', url: 'https://example.org/2', released: '2026-02-01', soundIdea: 'A quickening beat.' },
]

describe('Coming next shelf', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists each queued visualization with a link to NASA and no play button', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(queue))))
    const { container } = render(<ComingNext />)
    expect(await screen.findByRole('heading', { name: 'Coming next from NASA SVS' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View on NASA SVS: Pretend sea ice' })).toHaveAttribute('href', 'https://example.org/1')
    expect(screen.getAllByText('Sonification in preparation')).toHaveLength(2)
    expect(screen.queryByRole('button')).toBeNull()
    await expectNoA11yViolations(container)
  })

  it('shows nothing when the list cannot be read', async () => {
    const failing = vi.fn(async () => new Response('nope', { status: 404 }))
    vi.stubGlobal('fetch', failing)
    const { container } = render(<ComingNext />)
    await vi.waitFor(() => expect(failing).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
