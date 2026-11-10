import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import catalog from '../../public/data/index.json'
import { expectNoA11yViolations } from '../test/a11y'
import { DatasetPicker } from './DatasetPicker'

describe('DatasetPicker', () => {
  it('has a labelled choice with every data set, showing the current one', () => {
    render(<DatasetPicker catalog={catalog} value="synthetic-ocean" onChange={() => {}} />)
    const select = screen.getByRole('combobox', { name: 'Data set' })
    expect(select).toHaveValue('synthetic-ocean')
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Fixture ocean', 'Synthetic ocean', 'Synthetic globe (made-up practice data)', 'Synthetic change (made-up practice data)', 'Sea surface temperature around Mauritius, 2023', 'Synthetic motion (made-up practice data)', 'Synthetic storm (made-up practice data)'])
  })

  it('describes the chosen data set', () => {
    const { rerender } = render(<DatasetPicker catalog={catalog} value="fixture" onChange={() => {}} />)
    expect(screen.getByText(catalog[0].summary)).toBeInTheDocument()
    rerender(<DatasetPicker catalog={catalog} value="synthetic-ocean" onChange={() => {}} />)
    expect(screen.getByText(catalog[1].summary)).toBeInTheDocument()
    expect(screen.queryByText(catalog[0].summary)).toBeNull()
  })

  it('ties the description to the choice, so a screen reader reads both', () => {
    render(<DatasetPicker catalog={catalog} value="fixture" onChange={() => {}} />)
    const select = screen.getByRole('combobox', { name: 'Data set' })
    expect(select).toHaveAccessibleDescription(catalog[0].summary)
  })

  it('says which one was chosen, by keyboard or pointer', async () => {
    const onChange = vi.fn()
    render(<DatasetPicker catalog={catalog} value="fixture" onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Data set' }), 'Synthetic ocean')
    expect(onChange).toHaveBeenCalledWith('synthetic-ocean')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<DatasetPicker catalog={catalog} value="fixture" onChange={() => {}} />)
    await expectNoA11yViolations(container)
  })
})
