import { describe, expect, it } from 'vitest'
import { findHotspots, highestSerial, trackHotspots, UNTRACKED_ID } from './hotspots'
import { HOTSPOT_MIN_CELLS, HOTSPOTS_KEPT, TRACK_DISTANCE, type Band, type Hotspot } from './types'

const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }

/** A small grid from rows of text: `#` is a high cell, `.` a low one, `-` a middle one, `x` cannot be read. */
function gridOf(...lines: string[]) {
  const rows = lines.length
  const cols = lines[0].length
  const values = new Float32Array(cols * rows)
  lines.join('').split('').forEach((ch, i) => { values[i] = ch === 'x' ? NaN : ch === '#' ? 10 : ch === '.' ? 0 : 5 })
  const position = Float32Array.from(values, v => v / 10)
  const bandOf = (cell: number): Band | null => (values[cell] === 10 ? 'high' : values[cell] === 0 ? 'low' : null)
  return { grid: { cols, rows, values, position }, bandOf }
}

const spot = (id: string, band: Band, x: number, y: number, cells = 10): Hotspot => ({
  id, band, centroid: { x, y }, cells, areaShare: cells / 2048, peak: 1, peakPosition: 1,
})

describe('findHotspots', () => {
  it('finds a connected group with its centroid, size and strongest cell', () => {
    const { grid, bandOf } = gridOf('--------', '--##----', '--##----', '--------')
    const [found, ...rest] = findHotspots(grid, WHOLE, bandOf)
    expect(rest).toEqual([])
    expect(found).toMatchObject({ id: UNTRACKED_ID, band: 'high', cells: 4, peak: 10, peakPosition: 1 })
    expect(found.centroid.x).toBeCloseTo(3 / 8, 10) // cell centres 2.5 and 3.5 → 3.0 of 8 columns
    expect(found.centroid.y).toBeCloseTo(2 / 4, 10) // rows 1.5 and 2.5 → 2.0 of 4 rows
    expect(found.areaShare).toBeCloseTo(4 / 32, 10)
  })

  it('does not join cells that only touch at a corner', () => {
    const { grid, bandOf } = gridOf('##------', '##------', '--##----', '--##----')
    expect(findHotspots(grid, WHOLE, bandOf).map(h => h.cells)).toEqual([4, 4])
    const diagonal = gridOf('#-', '-#')
    expect(findHotspots(diagonal.grid, WHOLE, diagonal.bandOf)).toEqual([])
  })

  it('drops a group with fewer than HOTSPOT_MIN_CELLS cells', () => {
    const line = '#'.repeat(HOTSPOT_MIN_CELLS - 1)
    const { grid, bandOf } = gridOf(line + '-'.repeat(8 - line.length), '-'.repeat(8))
    expect(findHotspots(grid, WHOLE, bandOf)).toEqual([])
  })

  it('keeps high and low groups apart, and reports a low group by its smallest cell', () => {
    const { grid, bandOf } = gridOf('####....', '####....', '--------', '--------')
    const found = findHotspots(grid, WHOLE, bandOf)
    expect(found.map(h => h.band).sort()).toEqual(['high', 'low'])
    expect(found.find(h => h.band === 'low')).toMatchObject({ peak: 0, peakPosition: 0 })
  })

  it('never puts a cell that cannot be read in a group', () => {
    const { grid, bandOf } = gridOf('##x#----', '##x#----', '--------')
    // The unreadable column splits the two high columns, and the 2-cell column on its right is too small.
    expect(findHotspots(grid, WHOLE, bandOf).map(h => h.cells)).toEqual([4])
    // Even if the band function says yes for an unreadable cell, it is left out: 24 cells, 2 unreadable, all the others joined through the bottom row.
    const loud = findHotspots(grid, WHOLE, () => 'high')
    expect(loud.map(h => h.cells)).toEqual([22])
  })

  it('sorts the largest first, and equal sizes north before south and west before east', () => {
    const { grid, bandOf } = gridOf('##-##---', '##-##---', '--------', '##------', '##------')
    const found = findHotspots(grid, WHOLE, bandOf)
    expect(found.map(h => [h.centroid.x < 0.5 ? 'W' : 'E', h.centroid.y < 0.5 ? 'N' : 'S'])).toEqual([['W', 'N'], ['E', 'N'], ['W', 'S']])
    const mixed = gridOf('##------', '##------', '--------', '####----', '####----')
    expect(findHotspots(mixed.grid, WHOLE, mixed.bandOf).map(h => h.cells)).toEqual([8, 4])
  })

  it('keeps at most HOTSPOTS_KEPT groups', () => {
    const rows = ['##-##-##-##-##-##-##', '##-##-##-##-##-##-##']
    const { grid, bandOf } = gridOf(...rows)
    expect(findHotspots(grid, WHOLE, bandOf)).toHaveLength(HOTSPOTS_KEPT)
  })

  it('reports places as fractions of the whole image when the map is only part of it', () => {
    const { grid, bandOf } = gridOf('##', '##')
    const [found] = findHotspots(grid, { x0: 0.5, y0: 0.2, x1: 1, y1: 0.6 }, bandOf)
    expect(found.centroid.x).toBeCloseTo(0.75, 10)
    expect(found.centroid.y).toBeCloseTo(0.4, 10)
  })
})

describe('trackHotspots', () => {
  it('numbers the spots of a first frame h1, h2, … in the order given', () => {
    const tracked = trackHotspots([], [spot('', 'high', 0.2, 0.2), spot('', 'low', 0.8, 0.8)])
    expect(tracked.map(h => h.id)).toEqual(['h1', 'h2'])
  })

  it('gives a spot the id of the nearby spot of the same band', () => {
    const tracked = trackHotspots([spot('h4', 'high', 0.3, 0.3)], [spot('', 'high', 0.3 + TRACK_DISTANCE - 0.01, 0.3)])
    expect(tracked[0].id).toBe('h4')
  })

  it('does not match a spot that is further than TRACK_DISTANCE, or of the other band', () => {
    expect(trackHotspots([spot('h1', 'high', 0.3, 0.3)], [spot('', 'high', 0.3 + TRACK_DISTANCE + 0.01, 0.3)])[0].id).toBe('h2')
    expect(trackHotspots([spot('h1', 'high', 0.3, 0.3)], [spot('', 'low', 0.3, 0.3)])[0].id).toBe('h2')
  })

  it('matches the closest pairs first, and uses each previous spot once', () => {
    const previous = [spot('h1', 'high', 0.3, 0.5), spot('h2', 'high', 0.5, 0.5)]
    // `a` is nearer h2 than h1; `b` is between them but nearer h1.
    const current = [spot('', 'high', 0.46, 0.5), spot('', 'high', 0.36, 0.5)]
    expect(trackHotspots(previous, current).map(h => h.id)).toEqual(['h2', 'h1'])
    // Two spots near one previous spot: only the nearer takes its id; the other is new.
    expect(trackHotspots([spot('h1', 'high', 0.5, 0.5)], [spot('', 'high', 0.52, 0.5), spot('', 'high', 0.55, 0.5)]).map(h => h.id)).toEqual(['h1', 'h2'])
  })

  it('breaks an exact tie by the order of the previous spots', () => {
    const previous = [spot('h1', 'high', 0.4, 0.5), spot('h2', 'high', 0.6, 0.5)]
    expect(trackHotspots(previous, [spot('', 'high', 0.5, 0.5)])[0].id).toBe('h1')
  })

  it('counts a distance up the map as the picture shows it (aspect = height ÷ width)', () => {
    const previous = [spot('h1', 'high', 0.5, 0.2)]
    const current = [spot('', 'high', 0.5, 0.2 + 0.2)] // 0.2 of the height
    expect(trackHotspots(previous, current, { aspect: 1 })[0].id).toBe('h2') // as far as 0.2 of the width: too far
    expect(trackHotspots(previous, current, { aspect: 0.5 })[0].id).toBe('h1') // only 0.1 of the width
  })

  it('never issues an id twice: new numbers come after the highest one issued so far, not the highest one still showing', () => {
    const previous = [spot('h1', 'high', 0.2, 0.2)] // h2 and h3 were issued earlier and have vanished
    expect(trackHotspots(previous, [spot('', 'high', 0.8, 0.8)], { serial: 3 })[0].id).toBe('h4')
    expect(trackHotspots(previous, [spot('', 'high', 0.8, 0.8)])[0].id).toBe('h2') // without the count, the best it can do
  })

  it('numbers several new spots in order and keeps the order of the spots it was given', () => {
    const tracked = trackHotspots([spot('h5', 'high', 0.1, 0.1)], [spot('', 'low', 0.9, 0.9), spot('', 'high', 0.1, 0.1), spot('', 'low', 0.5, 0.9)])
    expect(tracked.map(h => h.id)).toEqual(['h6', 'h5', 'h7'])
  })

  it('does not change the spots it was given', () => {
    const current = [spot('', 'high', 0.2, 0.2)]
    trackHotspots([], current)
    expect(current[0].id).toBe('')
  })
})

describe('highestSerial', () => {
  it('reads the number out of the ids, and ignores ids it does not know', () => {
    expect(highestSerial([])).toBe(0)
    expect(highestSerial([spot('h2', 'high', 0, 0), spot('h11', 'low', 0, 0), spot('', 'low', 0, 0), spot('x7', 'low', 0, 0)])).toBe(11)
  })
})
