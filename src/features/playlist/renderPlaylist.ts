// Renders every data set in the catalogue, one after another (docs/PLAN.md §6.3, ticket SN12). Never in parallel: each render holds every
// frame's pictures and an audio buffer. A data set that fails is listed with its message, and the rest still render.

import { loadVisualization, type CatalogEntry, type Visualization } from '../../data'
import { renderSequence, type RenderDeps, type RenderOutput } from './renderSequence'

export type PlaylistItem =
  | { id: string; title: string; file: string; seconds: number }
  | { id: string; title: string; error: string }

export type PlaylistResult = {
  /** The data sets that rendered, in catalogue order. */
  outputs: RenderOutput[]
  /** `playlist.json`: no time stamp, so it is the same every time. */
  playlist: string
  items: PlaylistItem[]
}

export type PlaylistDeps = RenderDeps & {
  load?: (id: string) => Promise<Visualization>
  render?: (visualization: Visualization, deps: RenderDeps) => Promise<RenderOutput>
}

export type PlaylistOptions = {
  /** Called before each data set: "Rendering 2 of 5: <title>." */
  onProgress?: (message: string, index: number, total: number) => void
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

export async function renderPlaylist(entries: readonly CatalogEntry[], options: PlaylistOptions = {}, deps: PlaylistDeps = {}): Promise<PlaylistResult> {
  const load = deps.load ?? loadVisualization
  const render = deps.render ?? renderSequence
  const outputs: RenderOutput[] = []
  const items: PlaylistItem[] = []

  for (const [i, entry] of entries.entries()) {
    options.onProgress?.(`Rendering ${i + 1} of ${entries.length}: ${entry.title}.`, i, entries.length)
    try {
      const output = await render(await load(entry.id), deps)
      outputs.push(output)
      items.push({ id: output.id, title: output.title, file: `${output.id}.wav`, seconds: Math.round(output.seconds * 1000) / 1000 })
    } catch (error) {
      items.push({ id: entry.id, title: entry.title, error: messageOf(error) })
    }
  }

  return { outputs, playlist: `${JSON.stringify({ items }, null, 2)}\n`, items }
}
