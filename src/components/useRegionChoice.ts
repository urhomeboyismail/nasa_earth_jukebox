import { useCallback, useEffect, useState } from 'react'
import { regionFor, type Region, type Visualization } from '../data'
import { parseHash, replaceParams } from '../route'

const regionInAddress = () => parseHash(window.location.hash).params.get('region')

/**
 * The region the listener chose (F48), kept in the address as `region=<id>` so a link carries it. With no choice, or an id the data set
 * does not have, it is the primary region. Choosing a region never starts any sound.
 */
export function useRegionChoice(visualization: Pick<Visualization, 'regions'>): [Region, (id: string) => void] {
  const [id, setId] = useState(regionInAddress)
  // A link pasted into the same tab changes the address and nothing else.
  useEffect(() => {
    const onHashChange = () => setId(regionInAddress())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const choose = useCallback((next: string) => {
    setId(next)
    replaceParams({ region: next })
  }, [])
  return [regionFor(visualization, id), choose]
}
