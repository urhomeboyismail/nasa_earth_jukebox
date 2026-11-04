import type { PageProps } from '../types'

// Placeholder from T00. Owner: Mohammad (T12, T13).
export default function ComparePage({ visualization }: PageProps) {
  return <>
    <p>Choose two dates, listen to each, and decide which shows the change.</p>
    {visualization && <p>{visualization.comparisons.length} ready-made comparisons.</p>}
  </>
}
