import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import catalogJson from '../../../public/data/index.json'
import { catalogSchema } from '../../data/schema'
import { expectNoA11yViolations } from '../../test/a11y'
import { DiscSelector } from './DiscSelector'
import { usePublishPlaying } from './nowPlaying'

const catalog = catalogSchema.parse(catalogJson)

function Mode() {
  usePublishPlaying(true)
  return null
}

describe('DiscSelector', () => {
  it('has a labelled group with a disc for every data set, the current one checked', () => {
    render(<DiscSelector catalog={catalog} value="mur-sst-mauritius" onChange={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: 'Data set' })
    expect(screen.getAllByRole('radio').map(radio => radio.textContent)).toEqual(catalog.map(entry => entry.title))
    expect(screen.getByRole('radio', { name: 'Sea surface temperature around Mauritius, 2023' })).toBeChecked()
    expect(group).toHaveAccessibleDescription(expect.stringContaining(catalog[1].summary))
  })

  it('colours each disc by the family of its catalog entry, the ocean when none is given', () => {
    const withFamily = catalog.map(entry => (entry.id === 'sst-anomaly-global' ? { ...entry, family: 'atmosphere' as const } : entry))
    render(<DiscSelector catalog={withFamily} value="fixture" onChange={() => {}} />)
    const family = (name: string) => screen.getByRole('radio', { name }).querySelector('.disc')?.getAttribute('data-family')
    expect(family('Fixture ocean')).toBe('ocean')
    expect(family(withFamily[2].title)).toBe('atmosphere')
  })

  it('moves to the next and the previous disc with the arrow keys', async () => {
    const onChange = vi.fn()
    // Controlled like the app: the address changes and the choice follows. The key goes up at once, as a switch or a screen reader sends it;
    // Radix moves focus a moment later.
    function Controlled() {
      const [value, setValue] = useState('mur-sst-mauritius')
      return <DiscSelector catalog={catalog} value={value} onChange={id => { setValue(id); onChange(id) }} />
    }
    render(<Controlled />)
    screen.getByRole('radio', { name: 'Sea surface temperature around Mauritius, 2023' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('sst-anomaly-global')
    await waitFor(() => expect(screen.getByRole('radio', { name: /^Sea surface temperature anomaly/ })).toHaveFocus())
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('mur-sst-mauritius')
  })

  it('chooses a disc by pointer', async () => {
    const onChange = vi.fn()
    render(<DiscSelector catalog={catalog} value="fixture" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Sea surface temperature around Mauritius, 2023' }))
    expect(onChange).toHaveBeenCalledWith('mur-sst-mauritius')
  })

  it('lands the tonearm while a Listen mode plays, and lifts it when that mode goes', async () => {
    function Page() {
      const [on, setOn] = useState(false)
      return <><button onClick={() => setOn(!on)}>toggle</button>{on && <Mode />}<DiscSelector catalog={catalog} value="fixture" onChange={() => {}} /></>
    }
    const { container } = render(<Page />)
    const platter = container.querySelector('.disc-platter')
    expect(platter).toHaveAttribute('data-playing', 'false')
    await act(() => userEvent.click(screen.getByRole('button', { name: 'toggle' })))
    expect(platter).toHaveAttribute('data-playing', 'true')
    await act(() => userEvent.click(screen.getByRole('button', { name: 'toggle' })))
    expect(platter).toHaveAttribute('data-playing', 'false')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<DiscSelector catalog={catalog} value="fixture" onChange={() => {}} />)
    await expectNoA11yViolations(container)
  })
})
