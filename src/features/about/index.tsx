import type { PageProps } from '../types'

// Placeholder from T00. Owner: Roni (T43).
export default function AboutPage({ visualization }: PageProps) {
  return <>
    <p>Where the imagery comes from, and how its colours become sound.</p>
    {visualization && <p>Source: {visualization.source.name}. Credit: {visualization.source.credit}.</p>}
  </>
}
