import { useId, useState } from 'react'
import { playTone } from '../../audio/cues'
import { saveAudioPrefs } from '../../audio/prefs'
import { Button, Dialog, useAnnounce } from '../../components'
import { DETAIL_LEVELS, type DetailLevel } from '../../data'
import { writeStoredText } from '../../hooks/useStoredValue'
import { DETAIL_WORDS } from '../player/symphonyState'
import { DETAIL_KEY, PITCH_TONES_HZ, PITCH_TONE_SECONDS, scoreEarCheck, SIDE_TONE_HZ, type HigherAnswer, type SideAnswer } from './earCheckScore'
import './earCheck.css'

const HIGHER_ANSWERS: { id: HigherAnswer; label: string }[] = [
  { id: 'first', label: 'The first' },
  { id: 'second', label: 'The second' },
  { id: 'unsure', label: "Can't tell" },
]
const SIDE_ANSWERS: { id: SideAnswer; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'unsure', label: "Can't tell, or both" },
]

type Props = { onDone?: () => void }

/**
 * A two-question ear check: "Which is higher?" and "Left or right?". The answers suggest a starting detail level and say whether the
 * listener's left and right are swapped. Nothing plays until a button is pressed; Save stores both on this device.
 */
export function EarCheck({ onDone }: Props) {
  const announce = useAnnounce()
  const id = useId()
  const [higher, setHigher] = useState<HigherAnswer | null>(null)
  const [side, setSide] = useState<SideAnswer | null>(null)
  const [heardPitch, setHeardPitch] = useState(false)
  const [heardSide, setHeardSide] = useState(false)
  const [chosen, setChosen] = useState<DetailLevel | null>(null)
  const [saved, setSaved] = useState(false)

  const result = higher && side ? scoreEarCheck({ higher, side }) : null
  const detail = chosen ?? result?.detail ?? 'standard'

  function playPitch() {
    playTone(PITCH_TONES_HZ[0], PITCH_TONE_SECONDS, 0)
    playTone(PITCH_TONES_HZ[1], PITCH_TONE_SECONDS, 0, PITCH_TONE_SECONDS + 0.1)
    setHeardPitch(true)
    announce('Playing two tones.')
  }

  function playSide() {
    playTone(SIDE_TONE_HZ, 0.6, -1)
    setHeardSide(true)
    announce('Playing one tone.')
  }

  function answerHigher(answer: HigherAnswer) {
    setHigher(answer)
    setSaved(false)
    announce(answer === 'second' ? 'Tone one, lower. Tone two, higher. Next: left or right.' : `You answered: ${HIGHER_ANSWERS.find(a => a.id === answer)?.label}. The tones were: tone one lower, tone two higher. Next: left or right.`)
  }

  function answerSide(answer: SideAnswer) {
    setSide(answer)
    setSaved(false)
    setChosen(null)
    if (!higher) return
    const next = scoreEarCheck({ higher, side: answer })
    announce(`Suggested detail: ${DETAIL_WORDS[next.detail]}.${next.swapEars ? " Your left and right are swapped; we'll flip them." : ''} The tone was in the left ear.`)
  }

  function save() {
    if (!result) return
    saveAudioPrefs({ swapEars: result.swapEars })
    writeStoredText(DETAIL_KEY, detail)
    setSaved(true)
    announce(`Saved. Detail: ${DETAIL_WORDS[detail]}.${result.swapEars ? ' Left and right flipped.' : ''}`)
    onDone?.()
  }

  function again() {
    setHigher(null)
    setSide(null)
    setChosen(null)
    setSaved(false)
    setHeardPitch(false)
    setHeardSide(false)
    announce('Starting the ear check again.')
  }

  return (
    <section className="ear-check" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="ear-check__title">Check your ears</h3>
      <p className="ear-check__hint">Two quick questions, about 30 seconds. Headphones work best. This is not a hearing test.</p>

      <div className="ear-check__step" role="group" aria-labelledby={`${id}-q1`}>
        <p id={`${id}-q1`} className="ear-check__question">1. Which is higher?</p>
        <Button onClick={playPitch}>{heardPitch ? 'Play the two tones again' : 'Play the two tones'}</Button>
        <div className="ear-check__answers">
          {HIGHER_ANSWERS.map(({ id: answer, label }) => (
            <Button key={answer} pressed={higher === answer} disabled={!heardPitch} onClick={() => answerHigher(answer)}>{label}</Button>
          ))}
        </div>
      </div>

      {higher && (
        <div className="ear-check__step" role="group" aria-labelledby={`${id}-q2`}>
          <p id={`${id}-q2`} className="ear-check__question">2. Left or right?</p>
          <Button onClick={playSide}>{heardSide ? 'Play the tone again' : 'Play the tone'}</Button>
          <div className="ear-check__answers">
            {SIDE_ANSWERS.map(({ id: answer, label }) => (
              <Button key={answer} pressed={side === answer} disabled={!heardSide} onClick={() => answerSide(answer)}>{label}</Button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="ear-check__result">
          <p role="status">Suggested detail: {DETAIL_WORDS[result.detail]}</p>
          <fieldset className="ear-check__levels">
            <legend>Detail level</legend>
            {DETAIL_LEVELS.map(level => (
              <label key={level} className="player__style-option">
                <input type="radio" name={`${id}-detail`} checked={detail === level} onChange={() => setChosen(level)} />
                <span>{DETAIL_WORDS[level]}</span>
              </label>
            ))}
          </fieldset>
          {result.swapEars && <p>Your left and right are swapped; we'll flip them.</p>}
          <div className="ear-check__buttons">
            <Button variant="filled" onClick={save}>Save</Button>
            <Button variant="text" onClick={again}>Start again</Button>
          </div>
          {saved && <p role="status">Saved on this device.</p>}
        </div>
      )}
    </section>
  )
}

/** A button that opens the ear check in a dialog. */
export function EarCheckButton({ label = 'Check your ears' }: { label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="text" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Check your ears">
        <EarCheck />
      </Dialog>
    </>
  )
}
