import { useId } from 'react'
import { BASS_DB_RANGE } from '../../audio/ensemble'
import { setCuesOn, useCuesOn } from '../../audio/cues'
import { resetAudioPrefs, saveAudioPrefs, useAudioPrefs, type AudioPrefs } from '../../audio/prefs'
import { Button, Slider, useAnnounce } from '../../components'
import { STYLE_IDS, VOICE_IDS, type PresetId, type VoiceId } from '../../data'
import { presetFor } from '../../sonify'
import { playSample } from './soundSample'
import { VOICE_WORDS } from './symphonyState'

const SPEEDS: { id: AudioPrefs['speed']; label: string }[] = [
  { id: 'slow', label: 'Slow' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
]

type Props = {
  /** The data set's own preset: what "the data set's own sound" plays, and what the sample uses when no style is chosen. */
  ownPreset: PresetId
  /** Show the instrument checkboxes (the welcome; the Listen page has the voice mixer instead). */
  instruments?: boolean
  /** Show "Play sample" (the welcome; the Listen page plays the data itself). */
  sample?: boolean
  /** Show the switch for interface sounds (the Listen page). */
  cues?: boolean
}

const bassWords = (db: number) => (db === 0 ? 'Flat' : `${db > 0 ? 'plus' : 'minus'} ${Math.abs(db)} decibels`)

/**
 * The listener's sound: a music style, the Bass setting, the speed and (in the welcome) which instruments play. Everything is written to the
 * one preference store (src/audio/prefs.ts), so the welcome and the Listen page always agree. A style is a choice of taste and never carries data.
 */
export function SoundPrefs({ ownPreset, instruments = false, sample = false, cues = false }: Props) {
  const prefs = useAudioPrefs()
  const cuesOn = useCuesOn()
  const announce = useAnnounce()
  const id = useId()
  const chosen = prefs.style ? presetFor(prefs.style) : null

  function chooseStyle(style: PresetId | null) {
    saveAudioPrefs({ style })
    announce(style ? `Style: ${presetFor(style).label}. ${presetFor(style).sound ?? ''}`.trim() : 'Style: the data set\'s own sound.')
  }

  function toggleInstrument(voice: VoiceId, on: boolean) {
    const muted = on ? prefs.muted.filter(v => v !== voice) : [...prefs.muted, voice]
    saveAudioPrefs({ muted })
  }

  return (
    <div className="sound-prefs">
      <fieldset className="sound-prefs__styles" aria-describedby={`${id}-style`}>
        <legend>Music style</legend>
        <label className="player__style-option">
          <input type="radio" name={`${id}-style`} checked={prefs.style === null} onChange={() => chooseStyle(null)} />
          <span>The data set's own sound</span>
        </label>
        {STYLE_IDS.map(style => (
          <label key={style} className="player__style-option">
            <input type="radio" name={`${id}-style`} checked={prefs.style === style} onChange={() => chooseStyle(style)} />
            <span>{presetFor(style).label}</span>
          </label>
        ))}
      </fieldset>
      <p id={`${id}-style`} className="sound-prefs__hint">
        {chosen?.sound ? `${chosen.sound} ` : ''}Styles change the instruments, never what the data says.
      </p>

      <Slider label="Bass" min={-BASS_DB_RANGE} max={BASS_DB_RANGE} step={1} value={prefs.bassDb} onChange={bassDb => saveAudioPrefs({ bassDb })} describe={bassWords} />

      <div role="group" aria-label="Speed" className="player__speed">
        <span className="player__speed-label" aria-hidden="true">Speed</span>
        {SPEEDS.map(({ id: speed, label }) => (
          <Button key={speed} pressed={prefs.speed === speed} onClick={() => saveAudioPrefs({ speed })}>{label}</Button>
        ))}
      </div>

      {instruments && (
        <fieldset className="sound-prefs__instruments">
          <legend>Instruments</legend>
          {VOICE_IDS.map(voice => (
            <label key={voice} className="player__style-option">
              <input
                type="checkbox"
                checked={!prefs.muted.includes(voice)}
                disabled={voice === 'melody'}
                aria-describedby={voice === 'melody' ? `${id}-melody` : undefined}
                onChange={event => toggleInstrument(voice, event.currentTarget.checked)}
              />
              <span>{VOICE_WORDS[voice]}</span>
            </label>
          ))}
          <p id={`${id}-melody`} className="sound-prefs__hint">The melody always plays: it carries the main value.</p>
        </fieldset>
      )}

      {cues && (
        <label className="player__style-option">
          <input type="checkbox" checked={cuesOn} aria-describedby={`${id}-cues`} onChange={event => setCuesOn(event.currentTarget.checked)} />
          <span>Interface sounds</span>
        </label>
      )}
      {cues && <p id={`${id}-cues`} className="sound-prefs__hint">Short quiet tones, each with its words on screen: the voice guide connects (rising) or ends (falling), an answer is ready, or something fails (two low blips). Playing starts (two rising blips) and finishes (two falling blips). In Compare, one blip comes before date A and two before date B. A save, copy or link made gives three rising blips. They never carry data.</p>}

      <div className="sound-prefs__buttons">
        {sample && <Button onClick={() => void playSample(presetFor(prefs.style ?? ownPreset))}>Play sample</Button>}
        <Button variant="text" onClick={() => { resetAudioPrefs(); announce('Back to the data set\'s own sound.') }}>Reset to the data set's sound</Button>
      </div>
    </div>
  )
}
