import { useId } from 'react'
import type { CatalogEntry } from '../data'

type Props = {
  catalog: CatalogEntry[]
  /** The id of the data set that is showing. */
  value: string
  onChange: (id: string) => void
}

/** Choose between the data sets listed in public/data/index.json. The summary of the current one sits under the choice. */
export function DatasetPicker({ catalog, value, onChange }: Props) {
  const id = useId()
  const current = catalog.find(entry => entry.id === value)
  return (
    <div className="ui-picker" data-tour="dataset-picker">
      <label htmlFor={id} className="ui-picker__label">Data set</label>
      <select id={id} value={value} onChange={event => onChange(event.target.value)} aria-describedby={current ? `${id}-summary` : undefined}>
        {catalog.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
      </select>
      {current && <p id={`${id}-summary`} className="ui-picker__summary">{current.summary}</p>}
    </div>
  )
}
