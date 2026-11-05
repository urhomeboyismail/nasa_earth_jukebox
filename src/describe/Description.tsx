import { useId } from 'react'
import type { FrameAnalysis } from '../analysis'
import type { Visualization } from '../data'
import { describeFrame, describeSequence } from '.'
import './description.css'

type Props = { visualization: Visualization; results: FrameAnalysis[]; index: number }

/**
 * The words for the date on screen, to be read on demand. It is not a live region: the player already announces a short
 * label as the date changes, and a long text read out every time would get in the way.
 */
export function Description({ visualization, results, index }: Props) {
  const headingId = useId()
  return (
    <section className="description" aria-labelledby={headingId}>
      <h2 id={headingId} className="description__title">Description</h2>
      <p className="description__text">{describeFrame(visualization, results, index)}</p>
      <details className="description__all">
        <summary>Describe all dates</summary>
        <p className="description__text">{describeSequence(visualization, results)}</p>
      </details>
    </section>
  )
}
