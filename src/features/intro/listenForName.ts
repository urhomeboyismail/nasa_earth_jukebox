// Listens once for a spoken name, with the browser's own speech recognition (the same kind "Hey Echo" uses). The result only
// fills the name box: a misheard name must be easy to fix, so nothing is submitted by voice.

import { recognitionCtor, type Recognition } from '../../assistant/wakeWord'
import { NAME_MAX } from './storage'

export const hasSpeechInput = () => recognitionCtor() !== null

/** "my name is Ana." becomes "Ana". */
export function cleanName(text: string): string {
  return text
    .replace(/^\s*(?:hi|hello|hey)?[\s,]*(?:my name(?:'s| is)|i am|i'm|im|call me|it's|it is|this is)\s+/i, '')
    .replace(/[.!?,]+$/, '')
    .trim()
    .slice(0, NAME_MAX)
}

export const LISTEN_MS = 8000

/** Starts listening. `onDone` gets the name, or '' when nothing was caught. Returns a function that stops it. */
export function listenForName(onDone: (name: string) => void): () => void {
  const Ctor = recognitionCtor()
  if (!Ctor) { onDone(''); return () => {} }
  let finished = false
  const rec: Recognition = new Ctor()
  const finish = (name: string) => {
    if (finished) return
    finished = true
    window.clearTimeout(timer)
    rec.onresult = rec.onerror = rec.onend = null
    rec.abort()
    onDone(name)
  }
  const timer = window.setTimeout(() => finish(''), LISTEN_MS)
  rec.continuous = false
  rec.interimResults = false
  rec.lang = document.documentElement.lang || 'en'
  rec.onresult = event => finish(cleanName(event.results[event.resultIndex]?.[0].transcript ?? ''))
  rec.onerror = () => finish('')
  rec.onend = () => finish('')
  try { rec.start() } catch { finish('') }
  return () => { finished = true; window.clearTimeout(timer); rec.onresult = rec.onerror = rec.onend = null; rec.abort() }
}
