// The mascot's optional spoken voice (F37). Only used after someone chose "I can see the map", which is a click, and never on the
// screen reader path: a screen reader is that listener's voice. Does nothing where the browser has no speech.
// While it speaks, any music ducks (src/audio/duck.ts, ticket SN13). `speak` resolves when the speech has ended, so a sound can wait for it.

import { duck } from '../../audio/duck'

/** Some browsers never send `end` for a cancelled or very long utterance; the promise settles anyway after this. */
const FALLBACK_MS = 20000

/** The ends of the utterances still speaking. Each one ends its own duck and resolves its promise, once. */
const pending = new Set<() => void>()

export function speak(text: string): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve()
  hush()
  return new Promise<void>(resolve => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      if (!pending.delete(finish)) return
      clearTimeout(timer)
      duck.end('speech')
      resolve()
    }
    pending.add(finish)
    duck.begin('speech')
    timer = setTimeout(finish, FALLBACK_MS)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = finish
    utterance.onerror = finish
    window.speechSynthesis.speak(utterance)
  })
}

export function hush() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  for (const finish of [...pending]) finish()
}
