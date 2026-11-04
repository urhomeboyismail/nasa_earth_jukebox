import type { PageProps } from '../types'

// Placeholder from T00. Owner: Roni (T42).
export default function LearnPage({ visualization }: PageProps) {
  return <>
    <p>Learn what each sound means before you listen to the data.</p>
    {visualization && <p>{visualization.mapping.categories.length} sounds, coolest to warmest: {visualization.mapping.categories.map(category => category.label).join(', ')}.</p>}
  </>
}
