// Cited facts for "Ask about this data". Every sentence is made from the analysis results and the manifest by rules, so the same
// data always gives the same words, and no number is typed in by hand. No model is involved.

import type { FrameAnalysis } from '../../analysis'
import type { Visualization } from '../../data'
import { dateFormatterFor } from '../../dates'

export type Fact = {
  id: string
  /** "data" is read from the frames. "text" describes the method or the source and is not a measurement. */
  kind: 'data' | 'text'
  text: string
}

const round = (value: number) => value.toFixed(1)
const signed = (value: number) => `${value > 0 ? '+' : ''}${round(value)}`

export function buildFacts(visualization: Visualization, results: FrameAnalysis[]): Fact[] {
  const { frames, variable, regions, source } = visualization
  const unit = variable.unit ? ` ${variable.unit}` : ''
  const name = variable.name.toLowerCase()
  const when = dateFormatterFor(frames.map(frame => frame.date))
  // Only dates that could be read count: a date with not enough data is a gap, never a low value.
  const read: { date: string; value: number }[] = []
  const missing: string[] = []
  results.forEach((result, i) => {
    if (result.category === 'insufficient' || result.medianValue === undefined) missing.push(when(frames[i].date))
    else read.push({ date: frames[i].date, value: result.medianValue })
  })
  const facts: Fact[] = []

  facts.push({
    id: 'F-dates', kind: 'data',
    text: `There are ${frames.length} dates, from ${when(frames[0].date)} to ${when(frames[frames.length - 1].date)}.`,
  })

  if (read.length) {
    const first = read[0]
    const last = read[read.length - 1]
    const lowest = read.reduce((a, b) => (b.value < a.value ? b : a))
    const highest = read.reduce((a, b) => (b.value > a.value ? b : a))
    facts.push({ id: 'F-first', kind: 'data', text: `On ${when(first.date)} the ${name} was about ${round(first.value)}${unit}.` })
    facts.push({ id: 'F-last', kind: 'data', text: `On ${when(last.date)} the ${name} was about ${round(last.value)}${unit}.` })
    facts.push({ id: 'F-lowest', kind: 'data', text: `The lowest reading was about ${round(lowest.value)}${unit}, on ${when(lowest.date)}.` })
    facts.push({ id: 'F-highest', kind: 'data', text: `The highest reading was about ${round(highest.value)}${unit}, on ${when(highest.date)}.` })
    if (read.length > 1) {
      facts.push({
        id: 'F-change', kind: 'data',
        text: `From ${when(first.date)} to ${when(last.date)} the ${name} changed by about ${signed(last.value - first.value)}${unit}.`,
      })
    }
  }

  facts.push({
    id: 'F-missing', kind: 'data',
    text: missing.length
      ? `There is not enough data for ${missing.join(', ')}. That is a gap in the source, not a zero.`
      : 'Every date has enough data to read.',
  })
  facts.push({ id: 'F-region', kind: 'text', text: `The sound is made from ${regions[0].name}. ${regions[0].description}` })
  facts.push({ id: 'F-source', kind: 'text', text: `The images come from ${source.name}. ${source.credit}.` })
  facts.push({
    id: 'F-method', kind: 'text',
    text: 'Each value is read from the colours of the image using its legend, so it is approximate. It is the middle value of many points, not an exact measurement.',
  })
  return facts
}

/** The stored questions, each tied to one fact. A question whose fact does not exist for this data set is not offered. */
export const QUESTIONS: { id: string; question: string; aliases: string[]; factId: string }[] = [
  { id: 'dates', factId: 'F-dates', question: 'Which dates are there?', aliases: ['how many dates', 'time span', 'date range', 'what period'] },
  { id: 'first', factId: 'F-first', question: 'What was the value on the first date?', aliases: ['first reading', 'starting value', 'at the start', 'value at the beginning'] },
  { id: 'last', factId: 'F-last', question: 'What was the value on the last date?', aliases: ['last reading', 'final value', 'at the end', 'value at the end'] },
  { id: 'lowest', factId: 'F-lowest', question: 'What was the lowest value?', aliases: ['coldest', 'minimum', 'lowest reading', 'when was it lowest', 'coolest'] },
  { id: 'highest', factId: 'F-highest', question: 'What was the highest value?', aliases: ['warmest', 'maximum', 'highest reading', 'when was it highest', 'peak', 'hottest'] },
  { id: 'change', factId: 'F-change', question: 'How much did it change overall?', aliases: ['overall change', 'total change', 'difference between start and end', 'did it get warmer or colder', 'net change'] },
  { id: 'missing', factId: 'F-missing', question: 'Is any data missing?', aliases: ['missing data', 'gap', 'why is there a hiss', 'what does the hiss mean', 'no data', 'which date has no data', 'missing date'] },
  { id: 'region', factId: 'F-region', question: 'Which place does the sound come from?', aliases: ['which area', 'where is this', 'what region', 'which region'] },
  { id: 'source', factId: 'F-source', question: 'Where do the images come from?', aliases: ['data source', 'who made the data', 'where is the data from', 'credit', 'source of the data'] },
  { id: 'method', factId: 'F-method', question: 'How exact are the values?', aliases: ['how accurate', 'how precise', 'is this exact', 'how are values read', 'how is it measured'] },
]
