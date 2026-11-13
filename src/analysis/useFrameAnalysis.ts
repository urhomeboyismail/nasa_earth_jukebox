// Reads every frame of a data set once, when its page opens: the category of each date (and, with a baseline, its change step).
// A result that arrives after the inputs changed, or after the page left, is dropped.

import { useEffect, useState } from 'react'
import type { Region, Visualization } from '../data'
import { analyzeAll, type FrameAnalysis } from '.'

export type FrameAnalysisResult = { results: FrameAnalysis[] | null; error: string }

/**
 * `withChange` also reads each frame's change from normal (only when the data set has a baseline). Without it the call is
 * exactly what it was before the change style existed.
 */
export function useFrameAnalysis(
  visualization: Visualization,
  region: Region,
  options: { withChange?: boolean } = {},
): FrameAnalysisResult {
  const { frames, colorScale, mapping } = visualization
  const withChange = options.withChange ?? false
  const [state, setState] = useState<FrameAnalysisResult>({ results: null, error: '' })

  useEffect(() => {
    let cancelled = false
    const done = withChange
      ? analyzeAll(frames, region, colorScale, mapping, visualization)
      : analyzeAll(frames, region, colorScale, mapping)
    done
      .then(results => { if (!cancelled) setState({ results, error: '' }) })
      .catch((error: unknown) => { if (!cancelled) setState({ results: null, error: error instanceof Error ? error.message : String(error) }) })
    return () => { cancelled = true }
  }, [frames, region, colorScale, mapping, visualization, withChange])

  return state
}
