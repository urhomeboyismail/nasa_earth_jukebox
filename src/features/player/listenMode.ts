// Which way Listen plays (docs/PLAN.md §6.3, ticket SN07): Symphony reads each frame as it is shown and plays the ensemble; Simple is the player that plays
// one note per date; Scan (SN08) sweeps one frame from west to east. The choice is remembered on this device; without one, a data set with a `sonification` block opens in Symphony and
// every other data set in Simple, so a data set from before v3 plays as it always did.

import { useCallback, useState } from 'react'
import type { Visualization } from '../../data'

export type ListenMode = 'symphony' | 'simple' | 'scan'

const KEY = 'earth-jukebox:listen-mode'

/** The remembered mode, else Symphony for a data set that has a sonification block and Simple for one that has not. Storage can be blocked, so every access is guarded. */
export function readListenMode(hasSonification: boolean): ListenMode {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'symphony' || stored === 'simple' || stored === 'scan') return stored
  } catch {
    // Not remembered; the default below applies.
  }
  return hasSonification ? 'symphony' : 'simple'
}

export function useListenMode(visualization: Visualization): [ListenMode, (mode: ListenMode) => void] {
  const [mode, setMode] = useState<ListenMode>(() => readListenMode(visualization.sonification !== undefined))
  const choose = useCallback((next: ListenMode) => {
    setMode(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Not remembered, but the choice still holds for this visit.
    }
  }, [])
  return [mode, choose]
}
