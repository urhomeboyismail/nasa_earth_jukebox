// Which voices sound at each level of detail (docs/PLAN.md §6.3, ticket SN03). The ensemble (SN04) reads this; it does not copy it.

import type { DetailLevel, VoiceId } from '../data/sonification'

export const DETAIL_VOICES: Record<DetailLevel, readonly VoiceId[]> = {
  calm: ['melody', 'harmony', 'time'],
  standard: ['melody', 'harmony', 'time', 'bass', 'hotspots'],
  full: ['melody', 'harmony', 'bass', 'hotspots', 'rhythm', 'motion', 'time'],
}

export function voicesFor(detail: DetailLevel): readonly VoiceId[] {
  return DETAIL_VOICES[detail]
}
