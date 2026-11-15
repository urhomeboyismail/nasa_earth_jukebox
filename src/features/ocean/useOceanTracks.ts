import { useCallback, useEffect, useState } from 'react'
import { parseHash, replaceParams } from '../../route'
import { loadOceanIndex, loadOceanTrack, type OceanIndexEntry, type OceanTrack } from './schema'

/** `#listen?ocean=1` and `#compare?ocean=1` open the ocean tracks instead of the map data sets. */
export const OCEAN_PARAM = 'ocean'
export const isOceanView = () => parseHash(window.location.hash).params.get(OCEAN_PARAM) === '1'

const trackInAddress = () => parseHash(window.location.hash).params.get('track')

/**
 * The list of ocean tracks and the chosen one (`track=<id>` in the address; the first when none is named). Failures come back as
 * readable text, and the detail goes to the console.
 */
export function useOceanTracks() {
  const [entries, setEntries] = useState<OceanIndexEntry[] | null>(null)
  const [chosenId, setChosenId] = useState(trackInAddress)
  const [loaded, setLoaded] = useState<OceanTrack | null>(null)
  const [error, setError] = useState<{ id: string | null; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    loadOceanIndex()
      .then(index => { if (!cancelled) setEntries(index.datasets) })
      .catch((reason: unknown) => {
        console.error(reason)
        if (!cancelled) setError({ id: null, message: 'The list of ocean tracks could not be loaded. Reload the page.' })
      })
    return () => { cancelled = true }
  }, [])

  const entry = entries?.find(e => e.dataset_id === chosenId) ?? entries?.[0] ?? null
  useEffect(() => {
    if (!entry) return
    let cancelled = false
    loadOceanTrack(entry.data_url)
      .then(next => { if (!cancelled) setLoaded(next) })
      .catch((reason: unknown) => {
        console.error(reason)
        if (!cancelled) setError({ id: entry.dataset_id, message: 'This ocean track could not be loaded. Choose another, or reload the page.' })
      })
    return () => { cancelled = true }
  }, [entry])

  const choose = useCallback((id: string) => {
    setChosenId(id)
    replaceParams({ track: id })
  }, [])

  const track = loaded && entry && loaded.dataset_id === entry.dataset_id ? loaded : null
  const message = error && (error.id === null || error.id === entry?.dataset_id) ? error.message : ''
  return { entries, entry, track, error: message, choose }
}
