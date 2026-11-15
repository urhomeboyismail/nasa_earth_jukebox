// EIC06 T4: /listen?ocean=1. The ECCO2 ocean tracks: a picker and the video stage. Loaded only when opened.

import { LoadingIndicator, Notice, useAnnounce } from '../../components'
import { currentDataParam, hashFor } from '../../route'
import { OceanStage } from './OceanStage'
import { TrackPicker } from './TrackPicker'
import { useOceanTracks } from './useOceanTracks'
import { Credit } from './Credit'
import './ocean.css'

export default function OceanListen() {
  const { entries, entry, track, error, choose } = useOceanTracks()
  const announce = useAnnounce()
  return (
    <div className="ocean">
      <p><a href={hashFor('listen', { data: currentDataParam() })}>Back to the map data sets</a></p>
      {entries && entry && (
        <TrackPicker entries={entries} value={entry.dataset_id} onChange={id => { choose(id); announce(`${entries.find(e => e.dataset_id === id)?.title}. Press Play to start.`) }} />
      )}
      {entry && (
        <p className="ocean__try"><strong>Try this:</strong> {entry.what_you_will_try}</p>
      )}
      {error ? <Notice variant="error">{error}</Notice> : track ? <OceanStage key={track.dataset_id} track={track} /> : <LoadingIndicator label="Loading the ocean track…" />}
      <Credit track={track} />
    </div>
  )
}
