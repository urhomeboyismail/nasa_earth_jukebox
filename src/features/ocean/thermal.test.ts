import { describe, expect, it } from 'vitest'
import type { GridCell } from './schema'
import { fieldOf, mixFields, sampleField, thermalGradient, thermalRgb } from './thermal'

const calibration = { temp_min_c: 10, temp_max_c: 30 }
const grid = (cell: GridCell, rows = 2, cols = 2): GridCell[][] => Array.from({ length: rows }, () => Array.from({ length: cols }, () => cell))

describe('thermalRgb', () => {
  it('is deep blue at 0, green at 20 and red at 32 and above', () => {
    expect(thermalRgb(0)).toEqual([11, 35, 120])
    expect(thermalRgb(20)).toEqual([46, 170, 70])
    expect(thermalRgb(32)).toEqual([210, 30, 30])
    expect(thermalRgb(45)).toEqual(thermalRgb(32))
    expect(thermalRgb(-5)).toEqual(thermalRgb(0))
  })

  it('blends smoothly between the stops, and a value that is not a number is the coldest colour', () => {
    expect(thermalRgb(5)).toEqual([21, 87.5, 165])
    expect(thermalRgb(Number.NaN)).toEqual(thermalRgb(0))
    for (let c = 0; c <= 32; c += 0.5) expect(thermalRgb(c).every(channel => channel >= 0 && channel <= 255)).toBe(true)
  })

  it('gives the same colours as a CSS gradient for the scale', () => {
    const css = thermalGradient()
    expect(css).toContain('rgb(11 35 120) 0%')
    expect(css).toContain('rgb(46 170 70) 62.5%')
    expect(css).toContain('rgb(210 30 30) 100%')
  })
})

describe('fieldOf', () => {
  it('turns a cell back into degrees with the calibration', () => {
    expect(fieldOf(grid([0.5, 0.2, 0]), calibration).celsius[0]).toBeCloseTo(20)
    expect(fieldOf(grid([1, 0.2, 0]), calibration).celsius[0]).toBeCloseTo(30)
  })

  it('makes the flow go the way opposite to where it comes from: from the north goes south, from the east goes west', () => {
    const north = fieldOf(grid([0.5, 0.4, 0]), calibration)
    expect(north.u[0]).toBeCloseTo(0)
    expect(north.v[0]).toBeCloseTo(0.4) // y points down the screen, so south is positive
    const east = fieldOf(grid([0.5, 0.4, 0.25]), calibration)
    expect(east.u[0]).toBeCloseTo(-0.4)
    expect(east.v[0]).toBeCloseTo(0)
  })

  it('has no flow for a cell with no direction, and takes the mean temperature for a cell with no reading', () => {
    const plain = fieldOf(grid([0.5, 0.4]), calibration)
    expect([plain.u[0], plain.v[0]]).toEqual([0, 0])
    const gap: GridCell[][] = [[[0, 0.1, 0.1], [1, 0.1, 0.1]], [null, [0.5, 0.1, 0.1]]]
    const field = fieldOf(gap, calibration)
    expect(field.celsius[2]).toBeCloseTo(20) // the mean of 10, 30 and 20
    expect([field.u[2], field.v[2]]).toEqual([0, 0])
  })
})

describe('sampleField', () => {
  const values = new Float32Array([0, 10, 20, 30])

  it('is the cell value at a cell centre, and blends smoothly between centres', () => {
    expect(sampleField(values, 2, 2, 0.25, 0.25)).toBeCloseTo(0)
    expect(sampleField(values, 2, 2, 0.75, 0.75)).toBeCloseTo(30)
    expect(sampleField(values, 2, 2, 0.5, 0.25)).toBeCloseTo(5)
    expect(sampleField(values, 2, 2, 0.5, 0.5)).toBeCloseTo(15)
  })

  it('holds the edge value outside the centres', () => {
    expect(sampleField(values, 2, 2, 0, 0)).toBeCloseTo(0)
    expect(sampleField(values, 2, 2, 1, 1)).toBeCloseTo(30)
  })
})

describe('mixFields', () => {
  it('moves from one field towards the next', () => {
    const a = fieldOf(grid([0, 0.2, 0]), calibration)
    const b = fieldOf(grid([1, 0.6, 0]), calibration)
    const half = mixFields(a, b, 0.5)
    expect(half.celsius[0]).toBeCloseTo(20)
    expect(half.v[0]).toBeCloseTo(0.4)
  })

  it('keeps the first field when the two have different shapes', () => {
    const a = fieldOf(grid([0, 0.2, 0], 2, 2), calibration)
    expect(mixFields(a, fieldOf(grid([1, 0.6, 0], 2, 3), calibration), 0.5)).toBe(a)
  })
})
