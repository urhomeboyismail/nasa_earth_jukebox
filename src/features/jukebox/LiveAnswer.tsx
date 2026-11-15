// Echo's answer to a live data question (G13): the reply, its sound, the numbers behind it and the pictures, in the same order as
// Jukebox Studio's reply. The Live page and the voice guide's panel both show it, so a typed and a spoken question look the same.

import { useState } from 'react'
import { hashFor } from '../../route'
import { JukeboxPlayer } from './JukeboxPlayer'
import { LiveImages } from './LiveImages'
import type { MascotAnswer } from './mascotQuery'
import { SeriesTable } from './SeriesTable'

export function LiveAnswer({ answer }: { answer: MascotAnswer }) {
  /** WX02: the step of the sound being heard, marked in "Show the numbers". */
  const [step, setStep] = useState<number | null>(null)
  return (
    <section aria-label="Echo's answer" className="jukebox-studio__reply">
      <p>{answer.reply}</p>
      {answer.localId && <a href={hashFor('listen', { data: answer.localId })}>Open it in the app</a>}
      {answer.audio && <JukeboxPlayer payload={answer.audio} vision={null} onStep={setStep} />}
      {answer.series && <SeriesTable series={answer.series} current={step} />}
      {answer.pictures && <LiveImages key={answer.pictures.images.map(image => image.url).join(' ')} pictures={answer.pictures} />}
    </section>
  )
}
