// Words for what is on screen and what is heard (docs/PLAN.md §5.8), for screen readers and for anyone who wants the
// details written down. Rules only, never a language model: the same data always gives the same words (this folder is
// guarded by boundary.test.ts).

import type { FrameAnalysis, FrameGrid } from '../analysis'
import type { Frame, Visualization } from '../data'
import { dateFormatterFor } from '../dates'

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
const withUnit = (value: number, unit: string) => `${Math.round(value)}${unit === '%' ? '' : ' '}${unit}`

/** A visualization's own words: category labels, dates, the unit. Shared by all four descriptions. */
function vocabulary(visualization: Visualization) {
  const { categories } = visualization.mapping
  const formatDate = dateFormatterFor(visualization.frames.map(frame => frame.date))
  return {
    unit: visualization.variable.unit,
    formatDate,
    /** The date without its year ("February"), for a sentence that is already about that year. Years alone stay as they are. */
    withoutYear: (iso: string) => {
      const name = formatDate(iso)
      const year = iso.slice(0, 4)
      return name !== year && name.endsWith(year) ? name.slice(0, -year.length).trim() : name
    },
    /** The label in lower case ("warm"); "no data" for a date or cell that could not be read. */
    label: (category: string) => (category === 'insufficient' ? 'no data' : (categories.find(c => c.id === category)?.label ?? category).toLowerCase()),
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

/** One date: its category, how much could be read, and how it changed since the date before. */
export function describeFrame(visualization: Visualization, results: FrameAnalysis[], index: number): string {
  const result = results[index]
  const frame = result && frameOf(visualization, result)
  if (!result || !frame) return ''
  const vocab = vocabulary(visualization)
  const date = vocab.formatDate(frame.date)
  const region = visualization.regions.find(r => r.id === result.regionId)?.name ?? result.regionId

  if (result.category === 'insufficient') {
    const read = result.valid === 0 ? `None of the ${result.sampled} points could be read` : `Only ${result.valid} of ${result.sampled} points could be read`
    const sound = visualization.mapping.missingCue.type === 'noise' ? 'the hiss, not a note' : 'a warning sound, not a note'
    return `${date}. ${region}: not enough data. ${read} (land, cloud or labels), so this date plays ${sound}.`
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
    sentences.push(`Warmest: ${labelAt(warmest)}, ${datesIn(namesAt(warmest))}.`)
    sentences.push(`Coolest: ${labelAt(coolest)}, ${datesIn(namesAt(coolest))}.`)
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
  if (missing.length) sentences.push(`No data ${datesIn(missing)}.`)
  return sentences.join(' ')
}

const COMPASS = [
  ['north-west', 'north', 'north-east'],
  ['west', 'centre', 'east'],
  ['south-west', 'south', 'south-east'],
]

/** One cell of the map: its category and value, and where it is ("north-east (column 19 of 24, row 3 of 11)"). `col` and `row` start at 0. */
export function describeCell(visualization: Visualization, grid: FrameGrid, col: number, row: number): string {
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return 'That is outside the map.'
  const vocab = vocabulary(visualization)
  const cell = grid.cells[row * grid.cols + col]
  const where = `${COMPASS[Math.floor((row * 3) / grid.rows)][Math.floor((col * 3) / grid.cols)]} (column ${col + 1} of ${grid.cols}, row ${row + 1} of ${grid.rows})`
  if (cell.category === 'insufficient' || cell.value === null) return `No data (land, cloud or labels), ${where}.`
  return `${upperFirst(vocab.label(cell.category))}, about ${withUnit(cell.value, vocab.unit)}, ${where}.`
}

/** A row or a column of the map, as runs: "Row 3, west to east: no data for 4 cells, cool for 6, mild for 8". `index` starts at 0. */
export function describeSweep(visualization: Visualization, grid: FrameGrid, line: { kind: 'row' | 'column'; index: number }): string {
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
  // The unit is said once, on the first run: "no data for 4 cells, cool for 6, mild for 8".
  const text = runs.map((run, i) => `${vocab.label(run.category)} for ${run.length}${i === 0 ? (run.length === 1 ? ' cell' : ' cells') : ''}`).join(', ')
  return `${upperFirst(kind)} ${index + 1}, ${kind === 'row' ? 'west to east' : 'north to south'}: ${text}.`
}
