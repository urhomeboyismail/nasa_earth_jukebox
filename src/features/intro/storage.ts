// What the planet intro remembers on this device: that it has been shown and the name given. The name never leaves the device:
// it is not sent to the server, not put in the guide's context and not logged.

import { z } from 'zod'
import { readStoredText, useStoredValue, writeStoredText } from '../../hooks/useStoredValue'

export const INTRO_KEY = 'earth-jukebox:intro'
export const NAME_MAX = 40

export type IntroChoice = { seen: boolean; name?: string }

const stored = z.object({ seen: z.boolean().catch(false), name: z.string().max(NAME_MAX).optional().catch(undefined) })
const NOT_SEEN: IntroChoice = { seen: false }

function parse(text: string | null): IntroChoice {
  if (!text) return NOT_SEEN
  try {
    const result = stored.safeParse(JSON.parse(text))
    if (!result.success) return NOT_SEEN
    const { seen, name } = result.data
    return { seen, ...(name && { name }) }
  } catch {
    return NOT_SEEN
  }
}

export const readIntro = (): IntroChoice => parse(readStoredText(INTRO_KEY))

export function saveIntro(choice: IntroChoice) {
  writeStoredText(INTRO_KEY, JSON.stringify(choice))
}

export function useIntro(): IntroChoice {
  return useStoredValue(INTRO_KEY, parse, NOT_SEEN)[0]
}
