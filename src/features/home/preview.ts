// The Crate's "Play 10 seconds" (docs/tickets/UI03-crate-records.md): the data set's own checked frames, read like Listen reads them, turned into music by
// the same ruleset and played by the same ensemble, at Fast speed, for at most PREVIEW_SECONDS. No JSX, and nothing in the player or the analysis is
// edited: this only calls them.
//
// Nothing sounds before a click: start() must be called from one (WCAG 1.4.2). One preview is one ensemble and one source, both let go when it ends.

import { FrameSequenceSource } from '../../analysis/video/frameSequence'
import type { FrameSequenceOptions, LiveFrame } from '../../analysis/video/types'
import { createEnsemble, SCHEDULE_LOOKAHEAD_S, STOP_FADE_S, type Ensemble } from '../../audio/ensemble'
import { readAudioPrefs } from '../../audio/prefs'
import { loadVisualization, VOICE_IDS, type Visualization } from '../../data'
import { presetFor, toMusicFrame, type MusicFrame } from '../../sonify'

/** The longest a preview sounds, from its first frame. */
export const PREVIEW_SECONDS = 10
/** A preview always reads the frames quickly, whatever speed Listen is set to: ten seconds should cover as many dates as it can. */
export const PREVIEW_SPEED = 'fast'
/** When the frames run out first, the last chord rings for this long before the preview ends. */
export const PREVIEW_TAIL_MS = 500

/** The seams a test replaces: the ensemble (Tone) and the three things the frame reader needs (worker, PNG loader, picture decoder). */
export type PreviewDeps = Pick<FrameSequenceOptions, 'extract' | 'loadPixels' | 'loadBitmap'> & { ensemble?: Ensemble }

export type PreviewHooks = {
  /** The first frame is playing: "Preparing…" becomes "Stop preview". */
  onPlaying(): void
  /** Called once, whatever ended it. `error` is set only when it ended because something went wrong. */
  onEnd(error?: Error): void
}

export type Preview = {
  /** Starts the sound. Call it from the click. It never rejects: a failure comes to `onEnd`. */
  start(): Promise<void>
  /** Ends it now. Safe to call at any time, and more than once. */
  stop(): void
}

const manifests = new Map<string, Promise<Visualization>>()

/** A data set's manifest, loaded once for the whole page: the Crate draws its records from it and the preview plays from it. A failed load is tried again next time. */
export function loadManifest(id: string): Promise<Visualization> {
  let found = manifests.get(id)
  if (!found) {
    found = loadVisualization(id)
    found.catch(() => manifests.delete(id))
    manifests.set(id, found)
  }
  return found
}

/** For tests: forget every manifest. */
export function clearManifests(): void {
  manifests.clear()
}

export function createPreview(visualization: Visualization, hooks: PreviewHooks, deps: PreviewDeps = {}): Preview {
  const { ensemble: given, ...sourceSeams } = deps
  let ensemble: Ensemble | null = null
  let source: FrameSequenceSource | null = null
  let ended = false
  let ending = false
  let playing = false
  let cap: ReturnType<typeof setTimeout> | null = null
  let tail: ReturnType<typeof setTimeout> | null = null

  function finish(error?: Error) {
    if (ended) return
    ended = true
    if (cap !== null) clearTimeout(cap)
    if (tail !== null) clearTimeout(tail)
    source?.dispose()
    const last = ensemble
    if (last) {
      // stop() fades the sound out; the graph is let go once the fade is over.
      last.stop()
      setTimeout(() => last.dispose(), (STOP_FADE_S + 0.1) * 1000)
    }
    hooks.onEnd(error)
  }

  async function start() {
    if (ended || ensemble) return
    const prefs = readAudioPrefs()
    const spec = visualization.sonification
    const preset = presetFor(prefs.style ?? spec?.preset ?? 'major')
    const made = given ?? createEnsemble(preset, { timbre: spec?.timbre })
    ensemble = made
    made.setDetail(spec?.detail ?? 'standard')
    made.setBass(prefs.bassDb)
    // The listener's own muted voices stay muted (the Listen mixer's choice); a voice the manifest leaves out stays silent.
    const allowed = spec?.voices ?? VOICE_IDS
    for (const voice of VOICE_IDS) made.mute(voice, prefs.muted.includes(voice) || !allowed.includes(voice))

    try {
      await made.start()
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)))
      return
    }
    // Stopped while Tone was loading: nothing may sound.
    if (ended) return
    if (made.status() !== 'on') {
      finish(new Error('The browser has not allowed sound. Press the button again.'))
      return
    }

    let previous: MusicFrame | null = null
    const onFrame = (frame: LiveFrame) => {
      if (ended) return
      const music = toMusicFrame(frame.features, preset, previous)
      previous = music
      made.apply(music, made.now() + SCHEDULE_LOOKAHEAD_S)
      if (!playing) {
        playing = true
        // The cap counts from the first sound, so slow loading never eats into the ten seconds.
        cap = setTimeout(() => finish(), PREVIEW_SECONDS * 1000)
        hooks.onPlaying()
      }
    }
    const onStatus: FrameSequenceOptions['onStatus'] = (status, reason) => {
      if (ended) return
      if (status === 'error') finish(new Error(reason ?? 'The picture could not be read.'))
      else if (status === 'stopped' && !ending) {
        // The checked frames ran out before the ten seconds did.
        ending = true
        tail = setTimeout(() => finish(), PREVIEW_TAIL_MS)
      }
    }
    source = new FrameSequenceSource({ visualization, step: PREVIEW_SPEED, onFrame, onStatus, ...sourceSeams })
    source.start()
  }

  return { start, stop: () => finish() }
}
