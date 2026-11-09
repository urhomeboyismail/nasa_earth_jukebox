// The words the app uses to compare values and name what is measured (F36). A manifest can change any of them with `variable.words`;
// what it leaves out falls back to these. They are neutral, so a data set that does not name its own words is not described as a
// temperature: the data sets in the repo each set theirs in their manifest (docs/data-sources.md).

import type { VariableWords } from './types'

export const DEFAULT_WORDS: VariableWords = {
  higher: 'higher',
  lower: 'lower',
  highest: 'highest',
  lowest: 'lowest',
  edge: 'edge',
  thing: 'values',
}

/** The variable's words with every missing one filled in from the defaults. Accepts no variable, for a page that has not loaded one yet. */
export function variableWords(variable?: { words?: Partial<VariableWords> }): VariableWords {
  return { ...DEFAULT_WORDS, ...variable?.words }
}

/** "higher values" (or "warmer water", when a manifest says so): what a date shows more of. `thing` may be empty ("more ice"). */
export const higherPhrase = (words: VariableWords): string => [words.higher, words.thing].filter(Boolean).join(' ')
