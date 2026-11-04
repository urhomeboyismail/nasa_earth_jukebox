import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import HomePage from '.'

const visualization = fixture as Visualization

describe('Home page', () => {
  it('says what the app is, and which data is loaded', () => {
    render(<HomePage visualization={visualization} />)
    expect(screen.getByText(/turns NASA Earth imagery into sound/)).toBeInTheDocument()
    expect(screen.getByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
  })

  it('states the question the listener is asked', () => {
    render(<HomePage visualization={visualization} />)
    expect(screen.getByRole('heading', { name: 'What you will try' })).toBeInTheDocument()
    expect(screen.getByText(/which date shows warmer water/i)).toBeInTheDocument()
  })

  it('lists the three steps in order, each a link to its page', () => {
    render(<HomePage visualization={visualization} />)
    const steps = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')
    expect(steps).toHaveLength(3)
    const links = steps.map(step => within(step).getByRole('link'))
    expect(links.map(link => link.textContent)).toEqual(['Learn the sounds', 'Listen', 'Compare two dates'])
    expect(links.map(link => link.getAttribute('href'))).toEqual(['#learn', '#listen', '#compare'])
  })

  it('says the values are approximate and credits the imagery', () => {
    render(<HomePage visualization={visualization} />)
    expect(screen.getByText(/approximate/i)).toBeInTheDocument()
    expect(screen.getByText(/Earth Jukebox team/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'About the data' })).toHaveAttribute('href', '#about')
  })

  it('still shows the steps while the data is loading, and does not claim any data', () => {
    render(<HomePage visualization={null} />)
    expect(screen.getAllByRole('link')).not.toHaveLength(0)
    expect(screen.queryByText(/Now playing from/)).toBeNull()
    expect(screen.queryByText(/Imagery:/)).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<HomePage visualization={visualization} />)
    await expectNoA11yViolations(container)
  })
})
