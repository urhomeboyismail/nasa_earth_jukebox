import { useEffect, useRef, useState } from 'react'
import { Button, Card, useAnnounce } from '../../components'
import { loadCatalog } from '../../data'
import { renderPlaylist, type PlaylistDeps, type PlaylistItem } from './renderPlaylist'

type Download = { name: string; label: string; href: string }
type Failure = Extract<PlaylistItem, { error: string }>

type State =
  | { phase: 'idle' }
  | { phase: 'running'; message: string }
  | { phase: 'done'; downloads: Download[]; failed: Failure[] }
  | { phase: 'error'; message: string }

type Props = {
  /** For tests: replaces the reader and the renderer. */
  deps?: PlaylistDeps
}

const blobOf = (text: string, type: string) => new Blob([text], { type })

/** Renders every data set to a WAV, a caption file and a JSON file in the browser, only when the button is pressed. Nothing is uploaded. */
export function PlaylistPanel({ deps }: Props) {
  const announce = useAnnounce()
  const [state, setState] = useState<State>({ phase: 'idle' })
  const urls = useRef<string[]>([])

  const release = () => {
    urls.current.forEach(url => URL.revokeObjectURL(url))
    urls.current = []
  }
  // The links are blob URLs: free them when the panel goes away.
  useEffect(() => release, [])

  async function run() {
    release()
    const first = 'Rendering the playlist.'
    setState({ phase: 'running', message: first })
    announce(first)
    try {
      const entries = await loadCatalog()
      const result = await renderPlaylist(entries, {
        onProgress: message => {
          setState({ phase: 'running', message })
          announce(message)
        },
      }, deps)
      const downloads: Download[] = []
      const add = (name: string, label: string, blob: Blob) => {
        const href = URL.createObjectURL(blob)
        urls.current.push(href)
        downloads.push({ name, label, href })
      }
      for (const output of result.outputs) {
        add(`${output.id}.wav`, `Download ${output.title} as a WAV file`, output.wav)
        add(`${output.id}.vtt`, `Download ${output.title} as a captions file`, blobOf(output.vtt, 'text/vtt'))
        add(`${output.id}.json`, `Download ${output.title} as a JSON file`, blobOf(output.sidecar, 'application/json'))
      }
      add('playlist.json', 'Download the playlist as a JSON file', blobOf(result.playlist, 'application/json'))
      const failed = result.items.filter((item): item is Failure => 'error' in item)
      setState({ phase: 'done', downloads, failed })
      announce(failed.length ? `The playlist is ready. ${failed.length} could not be rendered.` : 'The playlist is ready. The download links are below.')
    } catch (error) {
      const message = `The playlist could not be rendered. ${error instanceof Error ? error.message : String(error)}`
      setState({ phase: 'error', message })
      announce(message)
    }
  }

  return (
    <Card title="Download the sound" headingLevel={2}>
      <p>Render every data set to a sound file, with its captions and a JSON file that says which date is at which second. This is made in your browser; nothing is uploaded.</p>
      <Button variant="primary" disabled={state.phase === 'running'} onClick={run}>Render the playlist</Button>
      {state.phase === 'running' && <p>{state.message}</p>}
      {state.phase === 'error' && <p role="alert">{state.message}</p>}
      {state.phase === 'done' && (
        <>
          {state.failed.length > 0 && (
            <>
              <p>These data sets could not be rendered:</p>
              <ul>{state.failed.map(item => <li key={item.id}>{item.title}: {item.error}</li>)}</ul>
            </>
          )}
          <ul>
            {state.downloads.map(download => (
              <li key={download.name}><a href={download.href} download={download.name}>{download.label}</a></li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
