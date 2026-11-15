// What the landing page remembers on this device: that it is done, the name and the sound vibe. The three keys are plain text, as the
// brief names them. The name also goes where the rest of the app reads it (the intro store) and the vibe becomes the active sound
// style (audio prefs), so nothing else has to know about this page. The name never leaves the device.

import { saveAudioPrefs } from '../../audio/prefs'
import type { PresetId } from '../../data'
import { readStoredText, writeStoredText } from '../../hooks/useStoredValue'
import { readIntro, saveIntro } from '../intro/storage'

export const ONBOARDING_DONE_KEY = 'ej_onboarding_done'
export const USER_NAME_KEY = 'userName'
export const AUDIO_PREFERENCE_KEY = 'audioPreference'

export const readLandingDone = () => readStoredText(ONBOARDING_DONE_KEY) === 'true'

/** Forgets that the landing was done, so a first-visit entry shows it again. */
export const resetLanding = () => writeStoredText(ONBOARDING_DONE_KEY, null)

/** Remembers the answers (a blank name or no style is forgotten) and that the landing is done. */
export function saveLanding(name: string, style: PresetId | null) {
  writeStoredText(USER_NAME_KEY, name || null)
  writeStoredText(AUDIO_PREFERENCE_KEY, style)
  saveIntro({ ...readIntro(), seen: true, ...(name && { name }) })
  saveAudioPrefs({ style })
  writeStoredText(ONBOARDING_DONE_KEY, 'true')
}

/** "Skip the welcome": done, without touching any answer given before. */
export const skipLanding = () => writeStoredText(ONBOARDING_DONE_KEY, 'true')
