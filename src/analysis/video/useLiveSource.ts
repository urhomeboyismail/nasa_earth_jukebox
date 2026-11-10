// The live source as a React hook (docs/PLAN.md §6.3, ticket SN06): create it for a <video> and a data set, report its status, and dispose it when the
// page goes. Nothing starts until start() is called, and start() belongs in the Play click.
// StrictMode mounts, unmounts and mounts again with the same state, so the disposal waits a moment and is cancelled if the component comes back.

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Visualization } from '../../data'
import type { SequenceSpeed } from './clock'
import { LiveSource } from './liveSource'
import type { LiveFrame, SourceStatus } from './types'

type Snapshot = { status: SourceStatus; reason: string | undefined }

function createStatusStore() {
  let snapshot: Snapshot = { status: 'idle', reason: undefined }
  const listeners = new Set<() => void>()
  return {
    get: () => snapshot,
    set(status: SourceStatus, reason?: string) {
      snapshot = { status, reason }
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type UseLiveSource = {
  video: HTMLVideoElement | null
  visualization: Visualization | null
  step?: SequenceSpeed
  onFrame: (frame: LiveFrame) => void
}

const NEVER = createStatusStore()

export function useLiveSource({ video, visualization, step, onFrame }: UseLiveSource): {
  status: SourceStatus
  reason: string | undefined
  start: () => void
  stop: () => void
  seek: (index: number) => void
} {
  // The newest onFrame is called, without a new source for each render.
  const relay = useMemo(() => {
    let current = onFrame
    return { call: (frame: LiveFrame) => current(frame), use: (next: (frame: LiveFrame) => void) => { current = next } }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- made once; the effect below keeps it current
  }, [])
  useEffect(() => {
    relay.use(onFrame)
  })

  // A new video, data set or speed is a new source, with a fresh status.
  const bundle = useMemo(() => {
    if (!video || !visualization) return null
    const store = createStatusStore()
    const source = new LiveSource({ video, visualization, step, onFrame: frame => relay.call(frame), onStatus: (status, reason) => store.set(status, reason) })
    return { store, source }
  }, [video, visualization, step, relay])

  // Which source the mounted component is using. A cleanup that finds its own source back in here (StrictMode re-running the effect) leaves it alone;
  // one that finds none (unmounted) or another (a new data set) disposes it. The disposal waits a microtask so the effect that follows can run first.
  const current = useRef<LiveSource | null>(null)
  useEffect(() => {
    const source = bundle?.source ?? null
    current.current = source
    return () => {
      current.current = null
      queueMicrotask(() => {
        if (source && current.current !== source) source.dispose()
      })
    }
  }, [bundle])

  const store = bundle?.store ?? NEVER
  const { status, reason } = useSyncExternalStore(store.subscribe, store.get)
  const start = useCallback(() => bundle?.source.start(), [bundle])
  const stop = useCallback(() => bundle?.source.stop(), [bundle])
  const seek = useCallback((index: number) => bundle?.source.seek(index), [bundle])
  return { status, reason, start, stop, seek }
}
