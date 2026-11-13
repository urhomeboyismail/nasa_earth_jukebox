// How much the words say (docs/PLAN.md §5.8, F19): "rich" is the full sentences, "concise" only the label, the rounded value
// and the change. The choice is remembered on this device and shared by everything that describes, so changing it in one place
// changes it everywhere at once.

import { readStored, useStoredValue } from '../hooks/useStoredValue'

export type Detail = 'concise' | 'rich'

const KEY = 'earth-jukebox:detail'

const parseDetail = (stored: string): Detail => (stored === 'concise' ? 'concise' : 'rich')

/** The remembered level, or 'rich'. */
export function readDescriptionDetail(): Detail {
  return readStored(KEY, parseDetail, 'rich')
}

/** The level and a way to choose it. Shared by everything that describes; when storage is blocked it still holds for this visit. */
export function useDescriptionDetail(): [Detail, (detail: Detail) => void] {
  return useStoredValue<Detail>(KEY, parseDetail, 'rich')
}
