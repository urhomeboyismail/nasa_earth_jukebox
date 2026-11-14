// The ensemble as a React hook (docs/PLAN.md §6.3, ticket SN04): create it, dispose it when the page goes, and read its status.
// StrictMode mounts, unmounts and mounts again with the same state, so the disposal waits a moment and is cancelled if the component comes back.

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { TimbreSpec } from '../../data/types'
import type { DetailLevel, Preset } from '../../sonify/types'
import { createEnsemble } from '.'
import type { Ensemble, EnsembleStatus } from './types'

/** `timbre` (SN14) must be the same object between renders, like `preset` (the manifest's own object is). */
export function useEnsemble(preset: Preset, detail: DetailLevel, timbre?: TimbreSpec): { ensemble: Ensemble; status: EnsembleStatus; start: () => Promise<void> } {
  // A new preset is a new ensemble. The detail is set by the effect below, before anything can sound (nothing does until start()).
  const ensemble = useMemo(() => createEnsemble(preset, { timbre }), [preset, timbre])

  // Which ensemble the mounted component is using. A cleanup that finds its own ensemble back in here (StrictMode re-running the effect) leaves it alone;
  // one that finds none (unmounted) or another (a new preset) disposes it. The disposal waits a microtask so the effect that follows a cleanup can run first.
  const current = useRef<Ensemble | null>(null)
  useEffect(() => {
    current.current = ensemble
    return () => {
      current.current = null
      queueMicrotask(() => {
        if (current.current !== ensemble) ensemble.dispose()
      })
    }
  }, [ensemble])

  useEffect(() => {
    ensemble.setDetail(detail)
  }, [ensemble, detail])

  const status = useSyncExternalStore(ensemble.onStatus, ensemble.status)
  const start = useCallback(() => ensemble.start(), [ensemble])
  return { ensemble, status, start }
}
