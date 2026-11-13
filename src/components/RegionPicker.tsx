import { useId } from 'react'
import type { Region } from '../data'

type Props = {
  regions: readonly Region[]
  /** The id of the region in use. */
  value: string
  onChange: (id: string) => void
}

/** Choose which region of the data set to listen to (F48). Shown only when the manifest has two or more. Uses the data-set picker's styles. */
export function RegionPicker({ regions, value, onChange }: Props) {
  const id = useId()
  if (regions.length < 2) return null
  const current = regions.find(region => region.id === value)
  return (
    <div className="ui-picker">
      <label htmlFor={id} className="ui-picker__label">Region</label>
      <select id={id} value={value} onChange={event => onChange(event.target.value)} aria-describedby={current ? `${id}-about` : undefined}>
        {regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
      </select>
      {current && <p id={`${id}-about`} className="ui-picker__summary">{current.description}</p>}
    </div>
  )
}
