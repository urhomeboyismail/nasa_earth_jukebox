// Creates the sound engine for a data set's mapping, once per mount (and again only if the mapping changes). Creation can
// fail where there is no audio, so the failure comes back as text for the page to show, never as a thrown error.

import { useMemo } from 'react'
import type { SoundMapping } from '../data'
import { createSoundEngine, type SoundEngine } from '.'

export type SoundEngineResult = { engine: SoundEngine | null; engineError: string }

/** With no mapping yet (a page still loading) there is no engine and no error. */
export function useSoundEngine(mapping: SoundMapping | null | undefined): SoundEngineResult {
  return useMemo((): SoundEngineResult => {
    if (!mapping) return { engine: null, engineError: '' }
    try {
      return { engine: createSoundEngine(mapping), engineError: '' }
    } catch (error) {
      return { engine: null, engineError: error instanceof Error ? error.message : String(error) }
    }
  }, [mapping])
}
