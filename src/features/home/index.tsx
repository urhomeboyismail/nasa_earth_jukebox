import type { PageProps } from '../types'

// Placeholder from T00. Owner: Roni.
export default function HomePage({ visualization }: PageProps) {
  return <>
    <p>Hear how our planet is changing. The Earth Jukebox turns NASA Earth imagery into sound.</p>
    {visualization && <p>Now playing from: {visualization.title}. {visualization.summary}</p>}
  </>
}
