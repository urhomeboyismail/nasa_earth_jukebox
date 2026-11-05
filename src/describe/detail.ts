// How much the words say (docs/PLAN.md §5.8, F19): "rich" is the full sentences, "concise" only the label, the rounded value
// and the change. The choice is remembered on this device and shared by everything that describes, so changing it in one place
// changes it everywhere at once.

import { useSyncExternalStore } from 'react'

export type Detail = 'concise' | 'rich'

const KEY = 'earth-jukebox:detail'

/** Kept in memory too, so the choice still holds for this visit when storage is blocked (private windows). */
let remembered: Detail = 'rich'
const listeners = new Set<() => void>()

/** The remembered level, or 'rich'. */
export function readDescriptionDetail(): Detail {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'concise' ? 'concise' : 'rich'
  } catch {
    return remembered
  }
}

function setDescriptionDetail(next: Detail) {
  remembered = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Not remembered for next time, but the choice still holds for this visit.
  }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useDescriptionDetail(): [Detail, (detail: Detail) => void] {
  const detail = useSyncExternalStore(subscribe, readDescriptionDetail, () => 'rich' as Detail)
  return [detail, setDescriptionDetail]
}
