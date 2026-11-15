import { describe, expect, it } from 'vitest'
import { cellAt, cutoffFor, gridLookup, moveCursor, panFor, pitchFor, pulseRateFor, scaleNotes, stepAt, swirlFor } from './mapping'

const CUTOFF = [250, 3500] as const
const PITCH = [82.41, 659.25] as const

describe('ocean mapping', () => {
  it('the step is floor(currentTime × 2), kept inside the timeline', () => {
    expect(stepAt(0, 134)).toBe(0)
    expect(stepAt(0.49, 134)).toBe(0)
    expect(stepAt(0.5, 134)).toBe(1)
    expect(stepAt(33.2, 134)).toBe(66)
    expect(stepAt(999, 134)).toBe(133)
    expect(stepAt(-1, 134)).toBe(0)
    expect(stepAt(Number.NaN, 134)).toBe(0)
  })

  it('the cutoff is exponential from 250 to 3,500 Hz', () => {
    expect(cutoffFor(0, CUTOFF)).toBeCloseTo(250)
    expect(cutoffFor(1, CUTOFF)).toBeCloseTo(3500)
    expect(cutoffFor(0.5, CUTOFF)).toBeCloseTo(Math.sqrt(250 * 3500))
    expect(cutoffFor(2, CUTOFF)).toBeCloseTo(3500)
  })

  it('the pitch is a pentatonic note inside the range, rising with warmth', () => {
    const notes = scaleNotes(PITCH)
    expect(notes).toHaveLength(16)
    expect(notes[0]).toBeCloseTo(82.41)
    expect(notes.at(-1)).toBeCloseTo(659.28, 1)
    expect(pitchFor(0, PITCH)).toBe(notes[0])
    expect(pitchFor(1, PITCH)).toBe(notes.at(-1))
    expect(notes).toContain(pitchFor(0.37, PITCH))
    expect(pitchFor(0.6, PITCH)).toBeGreaterThan(pitchFor(0.4, PITCH))
  })

  it('velocity sets the pulse rate and vorticity the swirl', () => {
    expect(pulseRateFor(0)).toBe(0.5)
    expect(pulseRateFor(1)).toBe(6)
    expect(swirlFor(0)).toBeCloseTo(0.1)
    expect(swirlFor(1)).toBeCloseTo(0.9)
  })

  it('the pan runs from -1 at the left column to +1 at the right', () => {
    expect(panFor(0, 16)).toBe(-1)
    expect(panFor(15, 16)).toBe(1)
    expect(panFor(7.5, 16)).toBeCloseTo(0)
    expect(panFor(0, 1)).toBe(0)
  })

  it('finds the cell under a point and reads the grid, with null for no ocean', () => {
    expect(cellAt(0, 0, 320, 160, 8, 16)).toEqual({ col: 0, row: 0 })
    expect(cellAt(319, 159, 320, 160, 8, 16)).toEqual({ col: 15, row: 7 })
    expect(cellAt(400, -5, 320, 160, 8, 16)).toEqual({ col: 15, row: 0 })
    const grid = [[null, [0.5, 0.2]], [[0.9, 0.1], [0.1, 0.3]]] satisfies ([number, number] | null)[][]
    expect(gridLookup(grid, { row: 0, col: 1 })).toEqual([0.5, 0.2])
    expect(gridLookup(grid, { row: 0, col: 0 })).toBeNull()
    expect(gridLookup(grid, { row: 9, col: 0 })).toBeNull()
    expect(gridLookup(null, { row: 0, col: 0 })).toBeNull()
  })

  it('arrow keys move the reticle one cell and stop at the edges', () => {
    expect(moveCursor({ col: 0, row: 0 }, 'ArrowRight', 8, 16)).toEqual({ col: 1, row: 0 })
    expect(moveCursor({ col: 0, row: 0 }, 'ArrowUp', 8, 16)).toEqual({ col: 0, row: 0 })
    expect(moveCursor({ col: 15, row: 7 }, 'ArrowDown', 8, 16)).toEqual({ col: 15, row: 7 })
    expect(moveCursor({ col: 3, row: 3 }, 'Enter', 8, 16)).toBeNull()
  })
})
