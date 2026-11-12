// The page behind /jukebox.html (dev.tsx): a text box for a payload, and the player.

import { useState } from 'react'
import { Notice } from '../../components'
import { JukeboxPlayer } from './JukeboxPlayer'
import { parseAudioPayload } from './payload'

/** A made-up payload, so the page plays something before anything is pasted. */
const SAMPLE = JSON.stringify(
  {
    base_bpm: 120,
    tracks: [
      { instrument: 'marimba', pitch_range: [60, 72], volume_curve: [0.2, 0.3, 0.45, 0.6, 0.8, 1, 0.8, 0.6, 0.45, 0.3, 0.2, 0, 0.5, 0.7, 0.9, 0.7] },
      { instrument: 'bass', pitch_range: [36, 43], volume_curve: [0.6, 0, 0.6, 0, 0.8, 0, 0.8, 0, 0.6, 0, 0.6, 0, 0.9, 0, 0.9, 0] },
    ],
  },
  null,
  2,
)

function read(text: string) {
  try {
    return parseAudioPayload(JSON.parse(text))
  } catch {
    return null
  }
}

export function DevPage() {
  const [text, setText] = useState(SAMPLE)
  const [payload, setPayload] = useState(() => read(SAMPLE))

  return (
    <main className="jukebox-dev">
      <h1>Jukebox player</h1>
      <label className="jukebox-dev__label">
        The route's answer, or its audio field, as JSON
        <textarea
          className="jukebox-dev__json"
          name="payload"
          value={text}
          spellCheck={false}
          onChange={event => {
            setText(event.target.value)
            setPayload(read(event.target.value))
          }}
        />
      </label>
      {payload ? <JukeboxPlayer payload={payload} /> : <Notice variant="error">This is not an audio payload.</Notice>}
    </main>
  )
}
