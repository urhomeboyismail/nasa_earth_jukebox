// Words for what is on screen and what is heard (docs/PLAN.md §5.8), for screen readers and for anyone who wants the
// details written down. Rules only, never a language model: the same data always gives the same words (this folder is
// guarded by boundary.test.ts).

import type { FrameAnalysis, FrameGrid, GridCell } from '../analysis'
import type { HiddenChange } from '../audio/coarse'
import { variableWords, type Frame, type Visualization } from '../data'
import { dateFormatterFor } from '../dates'
import type { Detail } from './detail'

export type { Detail } from './detail'
export { describeChange, describeContour } from './change'
export * from './announcements'

/** `detail` is 'rich' (the full sentences, and the default, so every existing call is unchanged) or 'concise'. */
export type DescribeOptions = { detail?: Detail }

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const word = (n: number) => NUMBER_WORDS[n] ?? String(n)

/** A list in words: "a", "a and b", "a, b and c". */
function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Lower-cases the first letter, unless the name has capitals of its own ("Arctic Ocean" stays as it is). */
const lowerFirst = (text: string) => (text.slice(1) === text.slice(1).toLowerCase() ? text.charAt(0).toLowerCase() + text.slice(1) : text)
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Dates in one item: named when there are up to three, counted after that ("in March and April", "on 5 dates"). */
function datesIn(names: string[]): string {
  return names.length > 3 ? `on ${names.length} dates` : `in ${listOf(names)}`
}

/** A value with its unit: "21 °C", "21%". */
export const withUnit = (value: number, unit: string) => `${Math.round(value)}${unit === '%' ? '' : ' '}${unit}`

/** A visualization's own words: category labels, dates, the unit. Shared by all four descriptions. */
function vocabulary(visualization: Visualization) {
  const { categories } = visualization.mapping
  const formatDate = dateFormatterFor(visualization.frames.map(frame => frame.date))
  return {
    unit: visualization.variable.unit,
    words: variableWords(visualization.variable),
    formatDate,
    /** The date without its year ("February"), for a sentence that is already about that year. Years alone stay as they are. */
    withoutYear: (iso: string) => {
      const name = formatDate(iso)
      const year = iso.slice(0, 4)
      return name !== year && name.endsWith(year) ? name.slice(0, -year.length).trim() : name
    },
    /** The label in lower case ("warm"); "not enough data" for a date or cell that could not be read. */
    label: (category: string) => (category === 'insufficient' ? 'not enough data' : (categories.find(c => c.id === category)?.label ?? category).toLowerCase()),
    /** Position from the coolest (0) up. */
    rank: (category: string) => categories.findIndex(c => c.id === category),
  }
}

type Vocabulary = ReturnType<typeof vocabulary>

const frameOf = (visualization: Visualization, result: FrameAnalysis): Frame | undefined =>
  visualization.frames.find(frame => frame.id === result.frameId)

/** The step from one category to another: "up two steps", "down one step". */
function stepsText(from: number, to: number): string {
  const steps = Math.abs(to - from)
  return `${to > from ? 'up' : 'down'} ${word(steps)} ${steps === 1 ? 'step' : 'steps'}`
}

/** What share of the points fell in each category, to the nearest 10%: "Mostly warm (70%), some mild (20%) and hot (10%)." */
function sharesText(result: FrameAnalysis, vocab: Vocabulary): string {
  if (!result.shares) return ''
  const listed = Object.entries(result.shares)
    .filter(([, share]) => share >= 0.1)
    .sort((a, b) => b[1] - a[1] || vocab.rank(a[0]) - vocab.rank(b[0]))
    .map(([id, share]) => ({ label: vocab.label(id), share, pct: Math.round(share * 10) * 10 }))
  if (!listed.length) return ''
  const text = (item: (typeof listed)[number]) => `${item.label} (${item.pct}%)`
  const [top, ...rest] = listed
  if (!rest.length) return top.pct === 100 ? `All ${top.label}.` : `Mostly ${text(top)}.`
  if (top.share >= 0.5) return `Mostly ${text(top)}, some ${listOf(rest.map(text))}.`
  return `Split between ${listOf(listed.map(text))}.`
}

/**
 * One date: its category, how much could be read, and how it changed since the date before.
 * Concise keeps the date, the label, the rounded value and the change: "March: warm, 21 °C, up two steps."
 */
export function describeFrame(visualization: Visualization, results: FrameAnalysis[], index: number, options: DescribeOptions = {}): string {
  const result = results[index]
  const frame = result && frameOf(visualization, result)
  if (!result || !frame) return ''
  const vocab = vocabulary(visualization)
  if (options.detail === 'concise') return conciseFrame(visualization, vocab, results, index, result, frame)
  const date = vocab.formatDate(frame.date)
  const region = visualization.regions.find(r => r.id === result.regionId)?.name ?? result.regionId

  if (result.category === 'insufficient') {
    const read = result.valid === 0 ? `None of the ${result.sampled} points could be read` : `Only ${result.valid} of ${result.sampled} points could be read`
    return `${date}. ${region}: not enough data. ${read} (land, cloud or labels), so this date plays the hiss, not a note.`
  }

  const parts = [
    `${date}. ${region}: ${vocab.label(result.category)}${result.medianValue === undefined ? '' : `, about ${withUnit(result.medianValue, vocab.unit)}`}.`,
    `${result.valid} of ${result.sampled} points could be read.`,
  ]

  // The comparison is with the last earlier date that has data, so a gap does not hide a change.
  const previousIndex = results.findLastIndex((r, i) => i < index && r.category !== 'insufficient')
  const previous = previousIndex >= 0 ? results[previousIndex] : undefined
  const previousFrame = previous && frameOf(visualization, previous)
  if (!previous || !previousFrame) {
    parts.push(index === 0 ? 'First date.' : 'First date with data.')
  } else {
    const before = vocab.rank(previous.category)
    const now = vocab.rank(result.category)
    const sameYear = previousFrame.date.slice(0, 4) === frame.date.slice(0, 4)
    const since = sameYear ? vocab.withoutYear(previousFrame.date) : vocab.formatDate(previousFrame.date)
    parts.push(before === now ? `Same as ${since}.` : `${upperFirst(stepsText(before, now))} from ${since} (${vocab.label(previous.category)}).`)
  }
  parts.push(sharesText(result, vocab))
  return parts.filter(Boolean).join(' ')
}

function conciseFrame(visualization: Visualization, vocab: Vocabulary, results: FrameAnalysis[], index: number, result: FrameAnalysis, frame: Frame): string {
  // Inside one year the date drops it ("March"), as the sequence description does; across years it keeps it.
  const { frames } = visualization
  const oneYear = frames[0].date.slice(0, 4) === frames[frames.length - 1].date.slice(0, 4)
  const date = oneYear ? vocab.withoutYear(frame.date) : vocab.formatDate(frame.date)
  if (result.category === 'insufficient') return `${date}: not enough data.`
  const value = result.medianValue === undefined ? '' : `, ${withUnit(result.medianValue, vocab.unit)}`
  const previous = results.findLast((r, i) => i < index && r.category !== 'insufficient')
  let change = ', first date'
  if (previous) {
    const before = vocab.rank(previous.category)
    const now = vocab.rank(result.category)
    change = before === now ? ', same' : `, ${stepsText(before, now)}`
  }
  return `${date}: ${vocab.label(result.category)}${value}${change}.`
}

/** The whole sequence: where it starts and ends, the warmest and coolest dates, the biggest change, the gaps. */
export function describeSequence(visualization: Visualization, results: FrameAnalysis[]): string {
  const vocab = vocabulary(visualization)
  const found = results.flatMap(result => {
    const frame = frameOf(visualization, result)
    return frame ? [{ result, date: frame.date }] : []
  })
  if (!found.length) return 'There are no dates.'
  // Inside one year the items drop it ("in July and August"); across years they keep it, so they stay clear.
  const oneYear = found[0].date.slice(0, 4) === found[found.length - 1].date.slice(0, 4)
  const dated = found.map(d => ({ result: d.result, name: oneYear ? vocab.withoutYear(d.date) : vocab.formatDate(d.date) }))
  const regionName = visualization.regions.find(r => r.id === results[0].regionId)?.name ?? results[0].regionId

  // "January to December 2024": the year is said once when both ends share it.
  const first = vocab.formatDate(found[0].date)
  const last = vocab.formatDate(found[found.length - 1].date)
  const year = /\d{4}$/.exec(last)?.[0]
  const from = oneYear && year && first !== last && first.endsWith(year) ? first.slice(0, -year.length).trim() : first
  const range = found.length === 1 ? first : `${from} to ${last}`
  const sentences = [`${dated.length} ${dated.length === 1 ? 'date' : 'dates'}, ${range}, in the ${lowerFirst(regionName)}.`]

  const withData = dated.filter(d => d.result.category !== 'insufficient')
  if (!withData.length) return [...sentences, 'No date had enough data.'].join(' ')

  const start = withData[0].result.category
  const end = withData[withData.length - 1].result.category
  sentences.push(start === end ? `It starts and ends ${vocab.label(start)}.` : `It starts ${vocab.label(start)} and ends ${vocab.label(end)}.`)

  const ranks = withData.map(d => vocab.rank(d.result.category))
  const warmest = Math.max(...ranks)
  const coolest = Math.min(...ranks)
  const namesAt = (rank: number) => withData.filter((_, i) => ranks[i] === rank).map(d => d.name)
  const labelAt = (rank: number) => vocab.label(withData[ranks.indexOf(rank)].result.category)
  if (warmest === coolest) {
    sentences.push(`Every date with data is ${labelAt(warmest)}, so there is no change.`)
  } else {
    sentences.push(`${upperFirst(vocab.words.highest)}: ${labelAt(warmest)}, ${datesIn(namesAt(warmest))}.`)
    sentences.push(`${upperFirst(vocab.words.lowest)}: ${labelAt(coolest)}, ${datesIn(namesAt(coolest))}.`)
    // The first of equal changes wins, so the same data always names the same pair.
    let biggest = { size: 0, at: 1 }
    for (let i = 1; i < withData.length; i++) {
      const size = Math.abs(ranks[i] - ranks[i - 1])
      if (size > biggest.size) biggest = { size, at: i }
    }
    const from = withData[biggest.at - 1]
    const to = withData[biggest.at]
    sentences.push(
      `Biggest change: ${stepsText(ranks[biggest.at - 1], ranks[biggest.at])}, from ${from.name} (${vocab.label(from.result.category)}) to ${to.name} (${vocab.label(to.result.category)}).`,
    )
  }

  const missing = dated.filter(d => d.result.category === 'insufficient').map(d => d.name)
  if (missing.length) sentences.push(`Not enough data ${datesIn(missing)}.`)
  return sentences.join(' ')
}

const COMPASS = [
  ['north-west', 'north', 'north-east'],
  ['west', 'centre', 'east'],
  ['south-west', 'south', 'south-east'],
]

/** One cell of the map: its category and value, and where it is ("north-east (column 19 of 24, row 3 of 11)"). `col` and `row` start at 0. */
export function describeCell(visualization: Visualization, grid: FrameGrid, col: number, row: number, options: DescribeOptions = {}): string {
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return 'That is outside the map.'
  const vocab = vocabulary(visualization)
  const cell = grid.cells[row * grid.cols + col]
  const compass = COMPASS[Math.floor((row * 3) / grid.rows)][Math.floor((col * 3) / grid.cols)]
  const concise = options.detail === 'concise'
  const where = concise ? compass : `${compass} (column ${col + 1} of ${grid.cols}, row ${row + 1} of ${grid.rows})`
  if (cell.category === 'insufficient' || cell.value === null) return `Not enough data${concise ? '' : ' (land, cloud or labels)'}, ${where}.`
  // Concise: "Warm, 21 °C, north-east."
  return `${upperFirst(vocab.label(cell.category))}, ${concise ? '' : 'about '}${withUnit(cell.value, vocab.unit)}, ${where}.`
}

/**
 * F33, "What the sound hides": how many of the changes between neighbouring dates a coarse sound would make inaudible, with one example.
 * `hidden` is from `hiddenChanges` (src/audio/coarse.ts); `changes` is the count of all changes.
 */
export function describeHidden(visualization: Visualization, results: FrameAnalysis[], hidden: HiddenChange[], changes: number): string {
  if (changes === 0) return 'The dates stay on the same step, so there is no change for a coarse sound to hide.'
  if (hidden.length === 0) return `Every one of the ${word(changes)} ${changes === 1 ? 'change' : 'changes'} between neighbouring dates is still heard in a coarse sound, so it hides nothing here.`
  const vocab = vocabulary(visualization)
  const dateOf = (i: number) => {
    const frame = frameOf(visualization, results[i])
    return frame ? vocab.formatDate(frame.date) : `date ${i + 1}`
  }
  const example = hidden[0]
  const from = results[example.from].category
  const to = results[example.to].category
  return `${upperFirst(word(hidden.length))} of ${word(changes)} ${changes === 1 ? 'change' : 'changes'} between neighbouring dates sound the same in a coarse sound with three notes. For example ${dateOf(example.from)} to ${dateOf(example.to)}: ${vocab.label(from)} to ${vocab.label(to)}. First the coarse sound, where they match, then the strict sound, where they differ.`
}

/** Where a cell is, for locking on it: "north-east, column 19, row 3". `col` and `row` start at 0. */
export function describePlace(grid: FrameGrid, col: number, row: number): string {
  const compass = COMPASS[Math.floor((row * 3) / grid.rows)][Math.floor((col * 3) / grid.cols)]
  return `${compass}, column ${col + 1}, row ${row + 1}`
}

/**
 * One cell followed through the dates (F23): where it started and where it ended, and which way it went.
 * `readings` is the cell on each date, in date order, with the date as it is shown.
 */
export function describeCellOverTime(visualization: Visualization, readings: { date: string; cell: GridCell }[], options: DescribeOptions = {}): string {
  const vocab = vocabulary(visualization)
  const valid = readings.flatMap(({ date, cell }) =>
    cell.value === null || cell.category === 'insufficient' ? [] : [{ date, value: cell.value, category: cell.category }])
  if (valid.length === 0) return `This place has not enough data on ${readings.length === 1 ? 'the date' : `any of the ${word(readings.length)} dates`}.`
  const concise = options.detail === 'concise'
  const say = ({ date, value, category }: (typeof valid)[number]) => `${upperFirst(vocab.label(category))}, ${concise ? '' : 'about '}${withUnit(value, vocab.unit)}, ${date}`
  if (valid.length === 1) return `Across ${word(readings.length)} dates this place has data on one: ${say(valid[0])}.`
  const first = valid[0]
  const last = valid[valid.length - 1]
  const missing = readings.length - valid.length
  const move = last.value > first.value ? 'rising' : last.value < first.value ? 'falling' : 'steady'
  return `Across ${word(readings.length)} dates, ${say(first)}, then ${say(last)}: ${move}.${missing ? ` ${upperFirst(word(missing))} ${missing === 1 ? 'date has' : 'dates have'} no data here.` : ''}`
}

/** A row or a column of the map, as runs: "Row 3, west to east: not enough data for 4 cells, cool for 6, mild for 8". `index` starts at 0. */
export function describeSweep(visualization: Visualization, grid: FrameGrid, line: { kind: 'row' | 'column'; index: number }, options: DescribeOptions = {}): string {
  const { kind, index } = line
  const length = kind === 'row' ? grid.cols : grid.rows
  const lines = kind === 'row' ? grid.rows : grid.cols
  if (!Number.isInteger(index) || index < 0 || index >= lines) return `There is no ${kind} ${index + 1}.`
  const vocab = vocabulary(visualization)

  const runs: { category: string; length: number }[] = []
  for (let i = 0; i < length; i++) {
    const cell = kind === 'row' ? grid.cells[index * grid.cols + i] : grid.cells[i * grid.cols + index]
    const last = runs[runs.length - 1]
    if (last && last.category === cell.category) last.length++
    else runs.push({ category: cell.category, length: 1 })
  }
  // Concise: "Row 3: not enough data 4, cool 6, mild 8." (the direction and the word "cells" are left out)
  if (options.detail === 'concise') return `${upperFirst(kind)} ${index + 1}: ${runs.map(run => `${vocab.label(run.category)} ${run.length}`).join(', ')}.`
  // The unit is said once, on the first run: "not enough data for 4 cells, cool for 6, mild for 8".
  const text = runs.map((run, i) => `${vocab.label(run.category)} for ${run.length}${i === 0 ? (run.length === 1 ? ' cell' : ' cells') : ''}`).join(', ')
  return `${upperFirst(kind)} ${index + 1}, ${kind === 'row' ? 'west to east' : 'north to south'}: ${text}.`
}
