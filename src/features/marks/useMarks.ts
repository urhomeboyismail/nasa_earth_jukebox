import { useSyncExternalStore } from 'react'
import type { Mark } from './marks'
import { getMarks, subscribeMarks } from './store'

/** Every saved mark, oldest first. */
export function useMarks(): Mark[] {
  return useSyncExternalStore(subscribeMarks, getMarks, getMarks)
}
