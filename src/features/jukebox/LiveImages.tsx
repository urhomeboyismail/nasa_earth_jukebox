// G12: Echo's live pictures, one at a time, with their date and alt text from a template, and "Play the pictures": one frame of music per picture
// every STEP_MS through the app's ensemble, each caption announced. Nothing sounds before the click (WCAG 1.4.2): the ensemble starts from it.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Pixels } from '../../analysis/analyze'
import { useEnsemble } from '../../audio/ensemble/useEnsemble'
import { Button, Notice, useAnnounce } from '../../components'
import { formatDate } from '../../dates'
import { altFor, LIVE_PRESET, musicFramesFor, STEP_MS, type LiveFrame } from './liveImages'
import type { LivePictures } from './mascotQuery'

type Props = {
  pictures: LivePictures
  /** Reads one picture's pixels. Tests pass their own (jsdom has no createImageBitmap). */
  load?: (url: string) => Promise<Pixels>
}

export function LiveImages({ pictures, load }: Props) {
  const { images } = pictures
  const { ensemble, start } = useEnsemble(LIVE_PRESET, 'full')
  const announce = useAnnounce()
  /** null while the pictures are being read; [] if they could not be read at all. */
  const [frames, setFrames] = useState<LiveFrame[] | null>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Bumped on every play and stop, so a click that was waiting for the audio to start does not carry on after a stop.
  const run = useRef(0)

  useEffect(() => {
    let current = true
    musicFramesFor(images, pictures.legend, load).then(
      read => current && setFrames(read),
      () => current && setFrames([]),
    )
    return () => {
      current = false
    }
  }, [images, pictures.legend, load])

  const finish = useCallback(() => {
    run.current++
    clearTimeout(timer.current)
    ensemble.stop()
    setPlaying(false)
  }, [ensemble])

  // Silence the pictures when leaving the page.
  useEffect(() => finish, [finish])

  async function play() {
    if (!frames?.length) return
    finish()
    const mine = run.current
    await start()
    if (mine !== run.current) return
    setPlaying(true)
    let i = 0
    const step = () => {
      if (mine !== run.current) return
      if (i >= frames.length) {
        finish()
        return
      }
      const { frame, loaded } = frames[i]
      ensemble.apply(frame)
      setIndex(i)
      announce(loaded ? frame.summary : `This picture did not load. ${frame.summary}`)
      i++
      timer.current = setTimeout(step, STEP_MS)
    }
    step()
  }

  const image = images[index]
  const failed = frames?.[index]?.loaded === false

  return (
    <section aria-label="Live pictures" className="live-images">
      {failed ? (
        <p>This picture did not load.</p>
      ) : (
        <img className="live-images__picture" src={image.url} crossOrigin="anonymous" alt={altFor(pictures, image.date)} />
      )}
      <p>
        Picture {index + 1} of {images.length}: {formatDate(image.date)}
      </p>
      <p className="live-images__credit">Imagery: Microsoft Planetary Computer</p>
      <div className="live-images__buttons">
        <Button disabled={playing || index === 0} onClick={() => setIndex(index - 1)}>Previous</Button>
        <Button disabled={playing || index === images.length - 1} onClick={() => setIndex(index + 1)}>Next</Button>
        <Button disabled={playing || !frames?.length} onClick={() => void play()}>Play the pictures</Button>
        <Button disabled={!playing} onClick={finish}>Stop</Button>
      </div>
      {!frames && <p role="status">Reading the pictures…</p>}
      {frames?.length === 0 && <Notice variant="error">The pictures could not be read.</Notice>}
    </section>
  )
}
