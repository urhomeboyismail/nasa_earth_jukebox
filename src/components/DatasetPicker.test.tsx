import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import catalogJson from '../../public/data/index.json'
import { catalogSchema } from '../data/schema'
import { expectNoA11yViolations } from '../test/a11y'
import { DatasetPicker } from './DatasetPicker'

const catalog = catalogSchema.parse(catalogJson)

describe('DatasetPicker', () => {
  it('has a labelled choice with every data set, showing the current one', () => {
    render(<DatasetPicker catalog={catalog} value="mur-sst-mauritius" onChange={() => {}} />)
    const select = screen.getByRole('combobox', { name: 'Data set' })
    expect(select).toHaveValue('mur-sst-mauritius')
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(catalog.map(entry => entry.title))
  })

  it('describes the chosen data set', () => {
    const { rerender } = render(<DatasetPicker catalog={catalog} value="fixture" onChange={() => {}} />)
    expect(screen.getByText(catalog[0].summary)).toBeInTheDocument()
    rerender(<DatasetPicker catalog={catalog} value="mur-sst-mauritius" onChange={() => {}} />)
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
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Data set' }), catalog[1].title)
    expect(onChange).toHaveBeenCalledWith('mur-sst-mauritius')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<DatasetPicker catalog={catalog} value="fixture" onChange={() => {}} />)
    await expectNoA11yViolations(container)
  })
})
