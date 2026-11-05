import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { FrameAnalysis } from '../analysis'
import type { Visualization } from '../data'
import { expectNoA11yViolations } from '../test/a11y'
import { describeFrame, describeSequence } from '.'
import { Description } from './Description'

const visualization = fixture as unknown as Visualization
const categories = ['cold', 'mild', 'hot', 'insufficient'] as const
const results: FrameAnalysis[] = visualization.frames.map((frame, i) => ({
  frameId: frame.id, regionId: visualization.regions[0].id, sampled: 9, valid: i === 3 ? 0 : 9, category: categories[i],
  ...(i === 3 ? {} : { medianValue: [3, 15, 27][i] }),
}))

describe('Description', () => {
  it('shows the words for the date on screen under a "Description" heading', () => {
    render(<Description visualization={visualization} results={results} index={1} />)
    const section = screen.getByRole('region', { name: 'Description' })
    expect(section).toHaveTextContent(describeFrame(visualization, results, 1))
    expect(screen.getByRole('heading', { level: 2, name: 'Description' })).toBeInTheDocument()
  })

  it('follows the date', () => {
    const { rerender } = render(<Description visualization={visualization} results={results} index={0} />)
    expect(screen.getByRole('region', { name: 'Description' })).toHaveTextContent('First date.')
    rerender(<Description visualization={visualization} results={results} index={3} />)
    expect(screen.getByRole('region', { name: 'Description' })).toHaveTextContent('not enough data')
  })

  it('keeps the whole sequence behind "Describe all dates"', async () => {
    render(<Description visualization={visualization} results={results} index={0} />)
    const summary = screen.getByText('Describe all dates')
    const sequence = describeSequence(visualization, results)
    expect(screen.getByText(sequence)).not.toBeVisible()
    await userEvent.click(summary)
    expect(screen.getByText(sequence)).toBeVisible()
  })

  it('is not a live region, so it never interrupts the player\'s own announcements', () => {
    const { container } = render(<Description visualization={visualization} results={results} index={0} />)
    expect(container.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Description visualization={visualization} results={results} index={2} />)
    await expectNoA11yViolations(container)
  })
})
