// Echo's face follows what the app is doing (docs/tickets/JB01-mascot-dock.md). Pure: the first rule that applies wins.

import type { MascotExpression } from '../../components/mascotTypes'
import type { AssistantStatus } from '../../hooks/useVoiceAssistant'

/** No input for this long (or a hidden tab) and Echo rests. */
export const IDLE_REST_MS = 60_000

export type FaceState = {
  /** A data set is loading. */
  loading: boolean
  voice: AssistantStatus
  /** The player is playing. */
  playing: boolean
  /** The waiting tip is an alert. */
  tipMood?: 'alert'
  /** Milliseconds since the last input. */
  idleMs: number
  /** The tab is hidden. */
  hidden: boolean
}

export function expressionFor(s: FaceState): MascotExpression {
  if (s.tipMood === 'alert') return 'alert'
  if (s.loading || s.voice === 'connecting') return 'searching'
  if (s.playing || s.voice === 'speaking') return 'eq_active'
  if (s.hidden || s.idleMs >= IDLE_REST_MS) return 'resting'
  return 'happy'
}
