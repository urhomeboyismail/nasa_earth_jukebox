import type { PageProps } from '../types'

// Placeholder from T00. Owner: Mohammad (T11).
export default function PlayerPage({ visualization }: PageProps) {
  return <>
    <p>Play a sequence of NASA imagery as sound, one date after another.</p>
    {visualization && <p>{visualization.frames.length} dates from {visualization.frames[0]?.date} to {visualization.frames.at(-1)?.date}.</p>}
  </>
}
