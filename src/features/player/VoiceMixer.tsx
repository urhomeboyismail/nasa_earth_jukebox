import { Button } from '../../components'
import type { VoiceId } from '../../data'
import { VOICE_WORDS } from './symphonyState'

type Props = {
  /** The voices that have a row. */
  voices: readonly VoiceId[]
  muted: ReadonlySet<VoiceId>
  solo: VoiceId | null
  onMute: (voice: VoiceId) => void
  onSolo: (voice: VoiceId) => void
}

/** One row a voice: Mute and Solo, both toggles. The names are words ("Mute melody"), never icons. */
export function VoiceMixer({ voices, muted, solo, onMute, onSolo }: Props) {
  return (
    <div className="symphony__mixer" role="group" aria-label="Voices">
      {voices.map(voice => (
        <div key={voice} className="symphony__voice">
          <span className="symphony__voice-name">{VOICE_WORDS[voice]}</span>
          <Button pressed={muted.has(voice)} onClick={() => onMute(voice)}>{`Mute ${VOICE_WORDS[voice]}`}</Button>
          <Button pressed={solo === voice} onClick={() => onSolo(voice)}>{`Solo ${VOICE_WORDS[voice]}`}</Button>
        </div>
      ))}
    </div>
  )
}
