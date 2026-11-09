import type { FrameAnalysis } from '../../analysis'
import type { Visualization } from '../../data'

type Props = {
  visualization: Visualization
  results: FrameAnalysis[]
  /** A date written out for this data set (see src/dates.ts). */
  formatDate: (date: string) => string
}

/** One row per date: what the sound is made from, for screen readers, braille displays and anyone who wants the numbers. */
export function DataTable({ visualization, results, formatDate }: Props) {
  const { frames, mapping, variable } = visualization
  const withChange = results.some(result => result.changeStep !== undefined)
  const label = (id: string) => (id === 'insufficient' ? 'Not enough data' : (mapping.categories.find(c => c.id === id)?.label ?? id))
  const stepLabel = (id: string) => (id === 'insufficient' ? 'Not enough data' : (mapping.changeSteps?.find(s => s.id === id)?.label ?? id))

  return (
    <div className="player__table" role="region" aria-label="Data table" tabIndex={0}>
      <table>
        <caption>
          {variable.name} for the region, one row per date. “No data” means the source had no usable data there. It is not zero.
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Value ({variable.unit})</th>
            <th scope="col">Category</th>
            {withChange && <th scope="col">Change from normal ({variable.unit})</th>}
            {withChange && <th scope="col">Change step</th>}
          </tr>
        </thead>
        <tbody>
          {results.map((result, i) => (
            <tr key={result.frameId}>
              <th scope="row">{formatDate(frames[i].date)}</th>
              <td>{result.medianValue === undefined ? 'No data' : result.medianValue.toFixed(1)}</td>
              <td>{label(result.category)}</td>
              {withChange && <td>{result.medianChange === undefined ? 'No data' : result.medianChange.toFixed(1)}</td>}
              {withChange && <td>{result.changeStep ? stepLabel(result.changeStep) : 'No data'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
