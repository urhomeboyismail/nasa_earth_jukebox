import { describe, expect, it } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameGrid } from '../../analysis'
import type { Visualization } from '../../data'
import { describeCell } from '../../describe'
import { QUERY_REPEAT_MS, nextLevel, parseVerbosity, startLevel, whatsHereText } from './whatsHere'

const visualization = fixture as Visualization

describe('nextLevel', () => {
  it('gives level 1 to a first question', () => {
    expect(nextLevel(null, 10_000)).toBe(1)
  })

  it('gives level 2 to a second question within 4 s', () => {
    expect(nextLevel({ at: 10_000, level: 1 }, 10_000 + QUERY_REPEAT_MS - 1)).toBe(2)
    expect(nextLevel({ at: 10_000, level: 2 }, 10_500)).toBe(2)
  })

  it('starts again at level 1 after 4 s', () => {
    expect(nextLevel({ at: 10_000, level: 2 }, 10_000 + QUERY_REPEAT_MS)).toBe(1)
    expect(nextLevel({ at: 10_000, level: 1 }, 60_000)).toBe(1)
  })

  it('starts again when the clock went backwards', () => {
    expect(nextLevel({ at: 10_000, level: 1 }, 9_000)).toBe(1)
  })

  it('starts at level 2 for full', () => {
    expect(startLevel('full')).toBe(2)
    expect(startLevel('brief')).toBe(1)
    expect(nextLevel(null, 0, 'full')).toBe(2)
    expect(nextLevel({ at: 0, level: 2 }, 100_000, 'full')).toBe(2)
  })
})

describe('parseVerbosity', () => {
  it.each([[null, 'brief'], ['brief', 'brief'], ['full', 'full'], ['FULL', 'brief'], ['', 'brief']])('reads %j as %s', (stored, verbosity) => {
    expect(parseVerbosity(stored)).toBe(verbosity)
  })
})

describe('whatsHereText', () => {
  const grid: FrameGrid = {
    frameId: 'f', cols: 6, rows: 3, area: { x0: 0, y0: 0, x1: 1, y1: 1 },
    cells: Array.from({ length: 18 }, (_, i) => (i % 6 === 5 ? { value: null, category: 'insufficient' as const } : { value: 21, category: 'warm' })),
  }

  it('says what the place shows at level 1, in the data set words', () => {
    expect(whatsHereText(visualization, grid, 4, 0, 1, 'rich')).toBe(describeCell(visualization, grid, 4, 0, { detail: 'rich' }))
    expect(whatsHereText(visualization, grid, 4, 0, 1, 'concise')).toBe(describeCell(visualization, grid, 4, 0, { detail: 'concise' }))
  })

  it('says where it is at level 2, as a sentence', () => {
    expect(whatsHereText(visualization, grid, 4, 0, 2, 'rich')).toBe('North-east, column 5, row 1.')
    expect(whatsHereText(visualization, grid, 0, 2, 2, 'concise')).toBe('South-west, column 1, row 3.')
  })

  it('gives the same words for the same grid, place and level', () => {
    expect(whatsHereText(visualization, grid, 5, 1, 1, 'rich')).toBe(whatsHereText(visualization, grid, 5, 1, 1, 'rich'))
  })
})
