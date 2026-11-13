import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HotspotMarker } from '../describe/markers'
import { expectNoA11yViolations } from '../test/a11y'
import { HotspotMarkers } from './HotspotMarkers'

const markers: HotspotMarker[] = [
  { id: 'h1', band: 'high', x: 0.8, y: 0.2, label: 'Warm area h1 in the north-east, about 4% of the map.' },
  { id: 'h2', band: 'low', x: 0.3, y: 0.7, label: 'Cold area h2 in the south-west, about 2% of the map.' },
]

describe('HotspotMarkers', () => {
  it('lists every hot spot as text for a screen reader', () => {
    render(<HotspotMarkers markers={markers} />)
    const list = screen.getByRole('list', { name: 'Hot spots on this date' })
    expect(within(list).getAllByRole('listitem').map(li => li.textContent)).toEqual(markers.map(m => m.label))
  })

  it('draws one still ring per hot spot at its centre, hidden from a screen reader', () => {
    const { container } = render(<HotspotMarkers markers={markers} />)
    const rings = container.querySelector('.hotspot-markers__rings')!
    expect(rings).toHaveAttribute('aria-hidden', 'true')
    const drawn = Array.from(rings.querySelectorAll<HTMLElement>('.hotspot-markers__ring'))
    expect(drawn.map(r => [r.style.left, r.style.top, r.textContent])).toEqual([['80%', '20%', 'h1'], ['30%', '70%', 'h2']])
    expect(container.innerHTML).not.toMatch(/animat/i)
  })

  it('draws nothing for a frame with no hot spots', () => {
    const { container } = render(<HotspotMarkers markers={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<HotspotMarkers markers={markers} />)
    await expectNoA11yViolations(container)
  })
})
