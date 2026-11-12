// The static question matcher, ported from the Two Ears prototype. Pure functions: no network, no model. A question is answered only if
// it is close to a stored question or alias. Anything else gets "Not in this record." and nothing is invented.

import { QUESTIONS, type Fact } from './facts'

export const NOT_FOUND = 'Not in this record.'
export const MAX_QUESTION_CHARS = 200
const THRESHOLD = 0.5

const STOP = new Set(('a an and are as at be been by did do does for from had has have how i in is it its me my of on or ' +
  'that the their there this to was were what when where which who why will with you your about tell please can could').split(' '))

/** Words that try to steer the answer instead of asking about the data. */
const STEERING = /\b(ignore|disregard|pretend|override|jailbreak|system prompt|forget your|act as|you are now)\b/i
/** Requests the record cannot serve: arithmetic, unit conversion, forecasts, and claims beyond the data. */
const OUT_OF_SCOPE = /\b(add|sum|multiply|divide|average of|convert|fahrenheit|kelvin|miles?|forecast|predict|will be|in the future|ever|always|never|worst|best|confirm)\b|record[- ]?(breaking|high|low)/i

export type Answer = {
  matched: boolean
  answer: string
  /** Fact ids the answer is made from. Empty when nothing matched. */
  factIds: string[]
  /** "From data", "From a cited fact" or "Description, not measured": set by code, never by the text. */
  confidence: string
  source: string
}

const normalise = (text: string) =>
  text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\-\s.]/g, ' ').replace(/\s+/g, ' ').trim()

/** Light stemming, so "dropped" and "drops", "readings" and "reading" meet. */
const stem = (word: string) => word.replace(/(ing|ed|es|s)$/, (match, _group, offset: number) => (offset >= 3 ? '' : match))

export function tokens(text: string): string[] {
  return normalise(text).replace(/(?<!\d)\.|\.(?!\d)/g, ' ').split(' ').filter(word => word && !STOP.has(word)).map(stem)
}

const DATE = /\b\d{4}-\d{2}-\d{2}\b/g
const YEAR = /\b(1[0-9]{3}|2[0-9]{3})\b/g

/** A question that names a year or date the data does not contain cannot be answered from it. */
function mentionsUnknownTime(question: string, knownDates: string[]): boolean {
  const known = new Set(knownDates)
  const years = new Set(knownDates.map(date => date.slice(0, 4)))
  if ((question.match(DATE) ?? []).some(date => !known.has(date))) return true
  return (question.replace(DATE, ' ').match(YEAR) ?? []).some(year => !years.has(year))
}

type Entry = { question: string; aliases: string[] }

/** Rare words count for more than common ones: weight = log(1 + N / document frequency). */
function weightsFor(entries: Entry[]) {
  const df = new Map<string, number>()
  for (const entry of entries) {
    for (const word of new Set([entry.question, ...entry.aliases].flatMap(tokens))) df.set(word, (df.get(word) ?? 0) + 1)
  }
  return (word: string) => Math.log(1 + entries.length / (df.get(word) ?? 0.5))
}

function score(query: string, entry: Entry, weight: (word: string) => number): number {
  const asked = tokens(query)
  if (!asked.length) return 0
  const normalised = normalise(query)
  let best = 0
  for (const phrase of [entry.question, ...entry.aliases]) {
    if (normalise(phrase) === normalised) return 1
    const words = tokens(phrase)
    if (!words.length) continue
    // A one-word phrase only counts for a very short question, or it matches far too much.
    if (words.length === 1 && asked.length > 2) continue
    const wanted = new Set(words)
    const given = new Set(asked)
    let shared = 0
    let total = 0
    for (const word of wanted) { total += weight(word); if (given.has(word)) shared += weight(word) }
    let union = total
    for (const word of given) if (!wanted.has(word)) union += weight(word)
    const coverage = total ? shared / total : 0
    const jaccard = union ? shared / union : 0
    best = Math.max(best, Math.min(coverage, 0.5 + 0.5 * jaccard))
  }
  return best
}

export const confidenceFor = (facts: Fact[]) => (facts.every(fact => fact.kind === 'data') ? 'From data' : 'Description, not measured')

const notFound = (): Answer => ({ matched: false, answer: NOT_FOUND, factIds: [], confidence: 'No answer', source: '' })

/** The questions that can be answered for this data set: those whose fact exists. */
export function availableQuestions(facts: Fact[]) {
  const ids = new Set(facts.map(fact => fact.id))
  return QUESTIONS.filter(question => ids.has(question.factId))
}

/** False for a question nothing may answer: empty or too long, steering, out of scope, or about a date the data does not have. */
export function guardsAllow(question: string, knownDates: string[]): boolean {
  const text = question.trim()
  return !(!text || text.length > MAX_QUESTION_CHARS || STEERING.test(text) || OUT_OF_SCOPE.test(text) || mentionsUnknownTime(text, knownDates))
}

export function ask(question: string, facts: Fact[], knownDates: string[]): Answer {
  const text = question.trim()
  if (!guardsAllow(text, knownDates)) return notFound()
  const entries = availableQuestions(facts)
  const weight = weightsFor(entries)
  let best: (typeof entries)[number] | null = null
  let bestScore = 0
  for (const entry of entries) {
    const value = score(text, entry, weight)
    if (value > bestScore) { best = entry; bestScore = value }
  }
  // More than half of a stored phrase must be there: half is one shared word in two, which is a coincidence.
  if (!best || bestScore <= THRESHOLD) return notFound()
  const fact = facts.find(item => item.id === best.factId)
  if (!fact) return notFound()
  return { matched: true, answer: fact.text, factIds: [fact.id], confidence: confidenceFor([fact]), source: `Source: ${fact.id}` }
}
