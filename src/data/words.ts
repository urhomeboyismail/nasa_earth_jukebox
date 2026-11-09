// The words the app uses to compare values and name what is measured (F36). A manifest can change any of them with `variable.words`;
// what it leaves out falls back to these, so a data set without the field reads exactly as before.

import type { VariableWords } from './types'

export const DEFAULT_WORDS: VariableWords = {
  higher: 'warmer',
  lower: 'cooler',
  highest: 'warmest',
  lowest: 'coolest',
  edge: 'warm edge',
  thing: 'water',
}

/** The variable's words with every missing one filled in from the defaults. Accepts no variable, for a page that has not loaded one yet. */
export function variableWords(variable?: { words?: Partial<VariableWords> }): VariableWords {
  return { ...DEFAULT_WORDS, ...variable?.words }
}

/** "warmer water": what a date shows more of. `thing` may be empty ("more ice"). */
export const higherPhrase = (words: VariableWords): string => [words.higher, words.thing].filter(Boolean).join(' ')
