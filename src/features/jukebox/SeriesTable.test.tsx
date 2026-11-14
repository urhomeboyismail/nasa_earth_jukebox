import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import { SeriesTable } from './SeriesTable'

const hours = { metric: 'Air temperature', unit: '°C', times: ['2026-11-14T00:00:00Z', '2026-11-14T13:00:00Z', '2026-11-14T23:00:00Z'], values: [21, 27.5, 22] }
const days = { metric: 'Cloud cover', unit: '%', times: ['2026-10-01', '2026-10-02'], values: [10, 90] }

describe('SeriesTable', () => {
  it('is closed until asked, then lists every value with its time', async () => {
    const { container } = render(<SeriesTable series={hours} current={null} />)
    const disclosure = screen.getByRole('group')
    expect(disclosure).not.toHaveAttribute('open')
    await userEvent.click(screen.getByText('Show the numbers'))
    expect(disclosure).toHaveAttribute('open')
    const table = screen.getByRole('table', { name: 'Air temperature (°C): 3 values, one for each note' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent(/(13:00|1:00\sPM).*UTC/) // the listener's own clock format
    expect(rows[1]).toHaveTextContent('27.5')
    await expectNoA11yViolations(container)
  })

  it('marks the row being heard, and only that one', async () => {
    render(<SeriesTable series={days} current={1} />)
    await userEvent.click(screen.getByText('Show the numbers'))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map(row => row.getAttribute('aria-current'))).toEqual([null, 'true'])
    expect(rows[0]).not.toHaveTextContent('UTC') // a day has no hour
  })
})
