// Stand-ins for the ensemble and the live source, for the Symphony tests: the real ones need Tone, a worker and a video. Not shipped; only tests import it.

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { vi } from 'vitest'
import type { LiveFrame, SourceStatus } from '../../analysis/video/types'
import type { Ensemble, EnsembleStatus } from '../../audio/ensemble/types'
import type { Visualization } from '../../data'
import { features } from '../../sonify/testFeatures'

export function createFakeEnsemble() {
  let status: EnsembleStatus = 'off'
  const listeners = new Set<() => void>()
  const control = { startsAs: 'on' as EnsembleStatus }
  const set = (next: EnsembleStatus) => {
    status = next
    for (const listener of [...listeners]) listener()
  }
  const ensemble = {
    start: vi.fn(async () => { set(control.startsAs) }),
    stop: vi.fn(() => set('off')),
    pause: vi.fn(() => set('paused')),
    resume: vi.fn(() => set('on')),
    apply: vi.fn(),
    hold: vi.fn(),
    playNotes: vi.fn(),
    playDropout: vi.fn(),
    solo: vi.fn(),
    mute: vi.fn(),
    setDetail: vi.fn(),
    setVolume: vi.fn(),
    status: () => status,
    now: () => 10,
    onStatus: (listener: (status: EnsembleStatus) => void) => {
      const wrapped = () => listener(status)
      listeners.add(wrapped)
      return () => { listeners.delete(wrapped) }
    },
    dispose: vi.fn(),
    renderOffline: vi.fn(async () => [new Float32Array(0), new Float32Array(0)] as [Float32Array, Float32Array]),
  } satisfies Ensemble
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  return { ensemble, control, set, subscribe, get status() { return status } }
}
export type FakeEnsemble = ReturnType<typeof createFakeEnsemble>

type SourceHookOptions = { onFrame: (frame: LiveFrame) => void; step?: string; video: HTMLVideoElement | null }

export function createFakeSource() {
  let snapshot: { status: SourceStatus; reason: string | undefined } = { status: 'idle', reason: undefined }
  const listeners = new Set<() => void>()
  const fake = {
    options: null as SourceHookOptions | null,
    startedAt: [] as (string | undefined)[],
    start: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    set(status: SourceStatus, reason?: string) {
      snapshot = { status, reason }
      for (const listener of [...listeners]) listener()
    },
    /** The hook the page calls in place of useLiveSource. */
    useLiveSource(options: SourceHookOptions) {
      fake.options = options
      const state = useSyncExternalStore(
        listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
        () => snapshot,
      )
      const step = options.step
      const start = useCallback(() => { fake.startedAt.push(step); fake.start() }, [step])
      return useMemo(() => ({ ...state, start, stop: fake.stop, seek: fake.seek }), [state, start])
    },
    /** A frame the source has read. */
    frame(date: string, o: { position?: number | null; confidence?: number } = {}): LiveFrame {
      const f = { ...features({ frameId: date, date, position: o.position ?? 0.6 }), confidence: o.confidence ?? 1 }
      return { features: f, date, videoIndex: null, mediaTime: null, confidence: f.confidence }
    },
  }
  return fake
}
export type FakeSource = ReturnType<typeof createFakeSource>

/** The fixture with the v3 blocks added, as a v3 data set has them. */
export function withV3(fixture: Visualization, extra: Partial<Visualization> = {}): Visualization {
  return {
    ...fixture,
    video: { src: 'video/x.mp4', fps: 10, firstFrameDate: fixture.frames[0].date, frameStepDays: 1 },
    sonification: { preset: 'major' },
    ...extra,
  }
}
