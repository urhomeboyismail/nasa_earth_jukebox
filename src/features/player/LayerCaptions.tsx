import type { VoiceId } from '../../data'
import type { MusicFrame } from '../../sonify'

type Props = { music: MusicFrame; voices: readonly VoiceId[]; muted: ReadonlySet<VoiceId>; solo: VoiceId | null }

/**
 * One line a voice that is sounding this frame, for a sighted listener (the caption already starts with the voice's name: "Melody: low"). Hidden from a screen reader on purpose: it changes with every frame, and the
 * "Now" line says the same in one sentence. Plain text that only changes: nothing moves or flashes, and colour is not the signal.
 */
export function LayerCaptions({ music, voices, muted, solo }: Props) {
  const lines = voices.filter(voice => music.caption[voice] !== '' && !muted.has(voice) && (solo === null || solo === voice))
  return (
    <ul className="symphony__captions" aria-hidden="true">
      {lines.map(voice => (
        <li key={voice}>{music.caption[voice]}</li>
      ))}
    </ul>
  )
}
