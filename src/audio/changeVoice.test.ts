import { Note } from 'tonal'
import { describe, expect, it } from 'vitest'
import type { Contour, ContourPoint } from '../analysis/types'
import { ACCENT_GAP_MS, bedFor, bedPower, contourEvents, cutoffFor, MAX_TRACE_MS, MIN_TRACE_MS } from './changeVoice'

// Five steps, most below normal first, each with its note in C3 to C4 (the shape T111 puts in the manifest).
const STEPS: { note: string; range: [number, number] }[] = [
  { note: 'C3', range: [-10, -1] },
  { note: 'E3', range: [-1, -0.25] },
  { note: 'G3', range: [-0.25, 0.25] },
  { note: 'A3', range: [0.25, 1] },
  { note: 'C4', range: [1, 10] },
]
const bed = (step: number, change?: number) => bedFor(step, STEPS.length, change, STEPS[step].range, STEPS[step].note)

describe('the change bed', () => {
  it("plays the step's own note, so pitch steps with the change", () => {
    expect(STEPS.map((_, k) => bed(k).note)).toEqual(['C3', 'E3', 'G3', 'A3', 'C4'])
  })

  it('never opens the filter below three times the fundamental, so the pitch heard does not move', () => {
    for (const [k, step] of STEPS.entries()) {
      for (const change of [step.range[0], step.range[1], undefined]) {
        expect(bed(k, change).cutoffHz).toBeGreaterThanOrEqual(3 * Note.freq(step.note)!)
      }
    }
  })

  it('is brighter for every higher step, even from the top of one step to the bottom of the next', () => {
    for (let k = 0; k + 1 < STEPS.length; k++) {
      expect(bed(k + 1, STEPS[k + 1].range[0]).cutoffHz).toBeGreaterThan(bed(k, STEPS[k].range[1]).cutoffHz)
    }
  })

  it('brightens a little inside a step with the change, and never changes the note', () => {
    const low = bed(2, -0.25)
    const high = bed(2, 0.25)
    expect(high.cutoffHz).toBeGreaterThan(low.cutoffHz)
    expect(high.cutoffHz / low.cutoffHz).toBeLessThan(1.25 + 1e-9)
    expect(high.note).toBe(low.note)
  })

  it('clamps a change outside its step and uses the middle when the step is open-ended or the change is missing', () => {
    expect(bed(2, 99).cutoffHz).toBe(bed(2, 0.25).cutoffHz)
    expect(bed(2, -99).cutoffHz).toBe(bed(2, -0.25).cutoffHz)
    const open = bedFor(4, 5, 3, [1, Infinity], 'C4')
    expect(open.cutoffHz).toBe(bedFor(4, 5, undefined, [1, 10], 'C4').cutoffHz)
    expect(bedFor(4, 5, NaN, [1, 10], 'C4').cutoffHz).toBe(open.cutoffHz)
  })

  it('levels the loudness across steps to within 1 dB, and warmer is never louder', () => {
    const levels = STEPS.flatMap((step, k) => [step.range[0], (step.range[0] + step.range[1]) / 2, step.range[1]].map(change => {
      const { note, cutoffHz, gainDb } = bed(k, change)
      expect(gainDb).toBeLessThanOrEqual(0)
      return 10 * Math.log10(bedPower(Note.freq(note)!, cutoffHz)) + gainDb
    }))
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(1)
  })

  it('is the same every time', () => {
    expect(bed(3, 0.6)).toEqual(bed(3, 0.6))
  })

  it('rejects a step that is not in the data set, and a note that is not a note', () => {
    expect(() => bedFor(5, 5, 0, [0, 1], 'C4')).toThrow('Step 5')
    expect(() => bedFor(-1, 5, 0, [0, 1], 'C4')).toThrow('Step -1')
    expect(() => bedFor(0, 5, 0, [0, 1], 'H9')).toThrow('not a note')
  })

  it('caps the cutoff below the top of the hearing range', () => {
    expect(cutoffFor(10000, 4, 1)).toBeLessThanOrEqual(12000)
  })
})

const point = (x: number, y: number, turn = 0, front = 1): ContourPoint => ({ x, y, turn, front })
/** A line of `count` points from (x0, y0) to (x1, y1), straight. */
function straight(count: number, [x0, y0]: [number, number], [x1, y1]: [number, number], extra: Partial<Contour> = {}): Contour {
  const points = Array.from({ length: count }, (_, k) => point(x0 + ((x1 - x0) * k) / (count - 1), y0 + ((y1 - y0) * k) / (count - 1)))
  return { level: 1, closed: false, brokenEnds: 0, brokenStart: false, brokenEnd: false, points, ...extra }
}
const withTurns = (contour: Contour, turns: Record<number, number>): Contour => ({
  ...contour,
  points: contour.points.map((p, k) => ({ ...p, turn: turns[k] ?? 0 })),
})

describe('the contour voice', () => {
  it('lasts as long as the line is, within 2 to 8 s', () => {
    const half = straight(64, [0.25, 0.5], [0.75, 0.5])
    expect(contourEvents(half, 'C5', 6000).durationMs).toBe(3000)
    expect(contourEvents(straight(64, [0.5, 0.5], [0.52, 0.5]), 'C5', 6000).durationMs).toBe(MIN_TRACE_MS)
    expect(contourEvents(straight(64, [0, 0], [1, 1]), 'C5', 6000).durationMs).toBe(MAX_TRACE_MS)
  })

  it('counts the closing segment of a closed line', () => {
    const open: Contour = { ...straight(4, [0.2, 0.2], [0.2, 0.2]), points: [point(0.2, 0.2), point(0.7, 0.2), point(0.7, 0.7), point(0.2, 0.7)] }
    const closed = { ...open, closed: true }
    expect(contourEvents(closed, 'C5', 4000).durationMs).toBeGreaterThan(contourEvents(open, 'C5', 4000).durationMs)
  })

  it('moves at a steady speed along the line, from the start to the end of the trace', () => {
    const { events, durationMs } = contourEvents(straight(64, [0, 0.5], [1, 0.5]), 'C5', 6000)
    expect(events).toHaveLength(64)
    expect(events[0].atMs).toBe(0)
    expect(events.at(-1)!.atMs).toBe(durationMs)
    const gaps = events.slice(1).map((e, k) => e.atMs - events[k].atMs)
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1)
    expect(events.map(e => e.index)).toEqual(events.map((_, k) => k))
  })

  it('pans from x, west to east, and raises from y, north to south', () => {
    const { events } = contourEvents(straight(64, [0, 0], [1, 1]), 'C5', 6000)
    expect(events[0]).toMatchObject({ pan: -1, elevation: 1 })
    expect(events.at(-1)).toMatchObject({ pan: 1, elevation: -1 })
    expect(events.map(e => e.pan)).toEqual([...events.map(e => e.pan)].sort((a, b) => a - b))
  })

  it('spends time on a short stretch of a line that stands still, without dividing by zero', () => {
    const still: Contour = { ...straight(2, [0.5, 0.5], [0.5, 0.5]) }
    const { events } = contourEvents(still, 'C5', 6000)
    expect(events.map(e => e.atMs)).toEqual([0, MIN_TRACE_MS])
    expect(contourEvents({ ...still, points: [point(0.5, 0.5)] }, 'C5', 6000).events).toHaveLength(1)
    expect(contourEvents({ ...still, points: [] }, 'C5', 6000)).toEqual({ durationMs: 0, events: [] })
  })

  it('is brighter where the front is steeper, and never below three times the note', () => {
    const line = straight(64, [0, 0.5], [1, 0.5])
    const steep = { ...line, points: line.points.map((p, k) => ({ ...p, front: k < 32 ? 0 : 5 })) }
    const { events } = contourEvents(steep, 'C5', 6000)
    expect(events[40].cutoffHz).toBeGreaterThan(events[10].cutoffHz)
    expect(events.every(e => e.cutoffHz >= 3 * Note.freq('C5')!)).toBe(true)
    const unreadable = { ...line, points: line.points.map(p => ({ ...p, front: NaN })) }
    expect(contourEvents(unreadable, 'C5', 6000).events.every(e => e.cutoffHz === 3 * Note.freq('C5')!)).toBe(true)
  })

  describe('accents', () => {
    const line = straight(64, [0, 0.5], [1, 0.5])

    it('fall where the line turns sharply, in either direction, and nowhere else', () => {
      const { events } = contourEvents(withTurns(line, { 20: Math.PI / 2, 50: -Math.PI / 2, 30: Math.PI / 4 }), 'C5', 6000)
      expect(events.filter(e => e.accent).map(e => e.index)).toEqual([20, 50])
    })

    it('mark the sharpest point of a corner that is spread over a few points, once', () => {
      const { events } = contourEvents(withTurns(line, { 19: 1, 20: 1.4, 21: 1.1 }), 'C5', 6000)
      expect(events.filter(e => e.accent).map(e => e.index)).toEqual([20])
    })

    it('are at least 125 ms apart, so there are at most 8 a second', () => {
      const wiggly = withTurns(line, Object.fromEntries(Array.from({ length: 32 }, (_, k) => [k * 2, k % 2 ? 1.2 : -1.2])))
      const accents = contourEvents(wiggly, 'C5', 6000).events.filter(e => e.accent)
      expect(accents.length).toBeGreaterThan(1)
      accents.slice(1).forEach((e, k) => expect(e.atMs - accents[k].atMs).toBeGreaterThanOrEqual(ACCENT_GAP_MS))
    })

    it('are left out on a straight line', () => {
      expect(contourEvents(line, 'C5', 6000).events.some(e => e.accent)).toBe(false)
    })
  })

  describe('the hiss at an end that stops at no data', () => {
    const base = straight(64, [0, 0.5], [1, 0.5])
    const hisses = (c: Contour) => contourEvents(c, 'C5', 6000).events.filter(e => e.hiss).map(e => e.index)

    it('is at the broken end only, whichever end it is', () => {
      expect(hisses({ ...base, brokenEnds: 1, brokenStart: true })).toEqual([0])
      expect(hisses({ ...base, brokenEnds: 1, brokenEnd: true })).toEqual([63])
      expect(hisses({ ...base, brokenEnds: 2, brokenStart: true, brokenEnd: true })).toEqual([0, 63])
    })

    it('is not there for a line that runs off the edge of the map, or for a closed one', () => {
      expect(hisses(base)).toEqual([])
      expect(hisses({ ...base, closed: true })).toEqual([])
    })
  })

  it('is the same every time', () => {
    const line = withTurns(straight(64, [0.1, 0.9], [0.8, 0.2]), { 10: 1.3 })
    expect(contourEvents(line, 'G5', 6000)).toEqual(contourEvents(line, 'G5', 6000))
  })
})
