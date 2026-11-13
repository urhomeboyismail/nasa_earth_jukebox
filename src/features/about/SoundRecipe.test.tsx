import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PRESETS } from '../../sonify/presets'
import { expectNoA11yViolations } from '../../test/a11y'
import { SoundRecipe } from './SoundRecipe'

describe('SoundRecipe', () => {
  it('is a table with a caption, header cells and a row for each of the seven voices', () => {
    render(<SoundRecipe preset={PRESETS.major} />)
    const table = screen.getByRole('table', { name: /seven voices/ })
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Voice', 'What drives it', 'What it sounds like', 'Plays from'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map(row => within(row).getByRole('rowheader').textContent)).toEqual(['Melody', 'Harmony', 'Bass', 'Hot spots', 'Rhythm', 'Motion', 'Time'])
    expect(within(rows[0]).getAllByRole('cell')[2]).toHaveTextContent('Calm')
    expect(within(rows[5]).getAllByRole('cell')[2]).toHaveTextContent('Full')
  })

  it('names the preset once, and says the key is an artistic choice', () => {
    render(<SoundRecipe preset={PRESETS.dorian} />)
    expect(screen.getAllByText('Dorian')).toHaveLength(1)
    expect(screen.getByText(/The choice is artistic/)).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<SoundRecipe preset={PRESETS.pentatonic} />)
    await expectNoA11yViolations(container)
  })
})
