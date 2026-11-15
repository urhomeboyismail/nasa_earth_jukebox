import type { OceanTrack } from './schema'

/** The credit the ticket asks for (a person still has to confirm it). A track with no video names its own source instead. */
export function Credit({ track }: { track?: OceanTrack | null }) {
  if (track && !track.visual_assets.video_url) return <p className="ocean__credit">Data: {track.metadata.source}.</p>
  return (
    <p className="ocean__credit">
      Video and data: NASA/Goddard Space Flight Center Scientific Visualization Studio,{' '}
      <a href="https://svs.gsfc.nasa.gov/3912" target="_blank" rel="noreferrer">SVS 3912 (ECCO2 model)</a>.
    </p>
  )
}
