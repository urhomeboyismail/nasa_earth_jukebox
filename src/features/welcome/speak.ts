// The mascot's optional spoken voice (F37). Only used after someone chose "I can see the map", which is a click, and never on the
// screen reader path: a screen reader is that listener's voice. Does nothing where the browser has no speech.

export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

export function hush() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
}
