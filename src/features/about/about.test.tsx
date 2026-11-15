import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { listedShortcuts } from '../../interaction/shortcuts'
import { expectNoA11yViolations } from '../../test/a11y'
import AboutPage from '.'

const visualization = fixture as Visualization

describe('About the data page', () => {
  it('shows a loading message until the data arrives', () => {
    render(<AboutPage visualization={null} />)
    expect(screen.getByText(/Loading the data/)).toBeInTheDocument()
  })

  it('says what the data is: the variable, unit, dates and place', () => {
    render(<AboutPage visualization={visualization} />)
    expect(screen.getByText(/Sea surface temperature, in °C/)).toBeInTheDocument()
    expect(screen.getByText('4 dates, from January 2024 to March 2025')).toBeInTheDocument()
    expect(screen.getByText(/Central ocean\. A grid of nine points/)).toBeInTheDocument()
  })

  it('says who it is for, how an image becomes sound, and what comes next', () => {
    render(<AboutPage visualization={visualization} />)
    for (const name of ['Who this is for', 'How a NASA image becomes sound', 'What comes next']) expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /From NASA image to sound: NASA video, then Frames/ })).toBeInTheDocument()
  })

  it('credits the source', () => {
    render(<AboutPage visualization={visualization} />)
    const source = screen.getByRole('heading', { name: 'Source and credits' }).closest('section')!
    expect(within(source).getByText('Synthetic test data')).toBeInTheDocument()
    expect(within(source).getByText('Earth Jukebox team')).toBeInTheDocument()
    expect(within(source).getByText('CC0')).toBeInTheDocument()
    expect(within(source).getByText('4 November 2026')).toBeInTheDocument()
  })

  it('links the source when it has a web address, and shows plain text when it does not', () => {
    const { rerender } = render(<AboutPage visualization={visualization} />)
    expect(screen.queryByRole('link', { name: 'Synthetic test data' })).toBeNull()
    rerender(<AboutPage visualization={{ ...visualization, source: { ...visualization.source, url: 'https://example.org/data' } }} />)
    expect(screen.getByRole('link', { name: 'Synthetic test data' })).toHaveAttribute('href', 'https://example.org/data')
  })

  it('has a table of every category with its range and note, and a row for missing data', () => {
    render(<AboutPage visualization={visualization} />)
    const table = screen.getByRole('table', { name: /Cooler is always a lower note/ })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map(row => [...row.querySelectorAll('th, td')].map(cell => cell.textContent))).toEqual([
      ['Cold', '0 to 6', 'C4'],
      ['Cool', '6 to 12', 'E4'],
      ['Mild', '12 to 18', 'G4'],
      ['Warm', '18 to 24', 'C5'],
      ['Hot', '24 to 30', 'E5'],
      ['Missing data', 'Not enough readable points', 'A hiss, not a note'],
    ])
  })

  it('has a legend table with each colour written as text as well as shown', () => {
    render(<AboutPage visualization={visualization} />)
    const table = screen.getByRole('table', { name: /colours we match against/ })
    expect(within(table).getByText('rgb(0, 0, 255)')).toBeInTheDocument()
    expect(within(table).getByText('rgb(255, 0, 0)')).toBeInTheDocument()
    expect(table.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3)
  })

  it('explains the method with the numbers from the data', () => {
    render(<AboutPage visualization={visualization} />)
    expect(screen.getByText(/3 colours, from 0 to 30 °C/)).toBeInTheDocument()
    expect(screen.getByText(/colour of 9 points in Central ocean/)).toBeInTheDocument()
    expect(screen.getByText(/more than 40 away in RGB/)).toBeInTheDocument()
    expect(screen.getByText(/fewer than 50% of the points/)).toBeInTheDocument()
    expect(screen.getByText(/one of 5 ranges/)).toBeInTheDocument()
  })

  it('writes the dates at the level the data has: years for a yearly set, days for a daily one', () => {
    const withDates = (dates: string[]): Visualization => ({
      ...visualization,
      frames: dates.map((date, i) => ({ ...visualization.frames[i % visualization.frames.length], id: `f${i}`, date })),
    })
    const { unmount } = render(<AboutPage visualization={withDates(['2022-09-15', '2023-09-18', '2024-09-11'])} />)
    expect(screen.getByText('3 dates, from 2022 to 2024')).toBeInTheDocument()
    unmount()
    render(<AboutPage visualization={withDates(['2024-09-15', '2024-09-16'])} />)
    expect(screen.getByText('2 dates, from 15 September 2024 to 16 September 2024')).toBeInTheDocument()
  })

  it('says missing data is never counted as a low value, in no temperature words (I02)', () => {
    render(<AboutPage visualization={visualization} />)
    expect(screen.getByText(/never counted as a low value/)).toBeInTheDocument()
    expect(screen.queryByText(/never counted as cold/)).toBeNull()
  })

  it('lists the dates with missing data', () => {
    render(<AboutPage visualization={visualization} />)
    expect(screen.getByText(/One date has missing data: March 2025/)).toBeInTheDocument()
  })

  it('takes every number from the manifest: change the data and the page changes', () => {
    const changed: Visualization = {
      ...visualization,
      variable: { name: 'Sea ice extent', unit: 'km²' },
      frames: visualization.frames.slice(0, 2).map(frame => ({ ...frame, note: undefined })),
      regions: [{ ...visualization.regions[0], name: 'Arctic', description: 'Four points near the pole.', points: visualization.regions[0].points.slice(0, 4) }],
      colorScale: { ...visualization.colorScale, maxColorDistance: 25 },
      mapping: {
        ...visualization.mapping,
        minValidFraction: 0.75,
        categories: [
          { id: 'low', label: 'Low', range: [0, 100], note: 'A3' },
          { id: 'high', label: 'High', range: [100, 200], note: 'B3' },
        ],
      },
    }
    render(<AboutPage visualization={changed} />)
    expect(screen.getByText(/Sea ice extent, in km²/)).toBeInTheDocument()
    expect(screen.getByText('2 dates, from January 2024 to July 2024')).toBeInTheDocument()
    expect(screen.getByText(/colour of 4 points in Arctic/)).toBeInTheDocument()
    expect(screen.getByText(/more than 25 away/)).toBeInTheDocument()
    expect(screen.getByText(/fewer than 75% of the points/)).toBeInTheDocument()
    expect(screen.getByText(/one of 2 ranges/)).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Low' })).toBeInTheDocument()
    expect(screen.getByText('B3')).toBeInTheDocument()
    expect(screen.queryByText(/missing data:/)).toBeNull()
    expect(screen.getByText(/Arctic\. Four points near the pole\./)).toBeInTheDocument()
    expect(screen.queryByText(/A grid of nine/)).toBeNull()
  })

  it('says how AI tools were used', () => {
    render(<AboutPage visualization={visualization} />)
    expect(screen.getByRole('heading', { name: 'How we used AI tools' })).toBeInTheDocument()
    expect(screen.getByText(/voice guide uses Google/)).toBeInTheDocument()
  })

  it('lets a keyboard user reach the tables, which can scroll sideways', () => {
    render(<AboutPage visualization={visualization} />)
    for (const name of ['Ranges and notes', 'Colour legend']) expect(screen.getByRole('region', { name })).toHaveAttribute('tabindex', '0')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<main><h1>About the data</h1><AboutPage visualization={visualization} /></main>)
    await expectNoA11yViolations(container)
  })

  it('lists every keyboard shortcut from the shared list, and has screen-reader help', () => {
    render(<AboutPage visualization={visualization} />)
    const table = screen.getByRole('table', { name: /Every key/ })
    const keyboard = listedShortcuts().filter(shortcut => shortcut.device === 'keyboard')
    expect(within(table).getAllByRole('row')).toHaveLength(keyboard.length + 1)
    expect(screen.getByRole('heading', { name: 'Using a screen reader' })).toBeInTheDocument()
  })
})
