import { describe, expect, it } from 'vitest'
import type { Hotspot } from '../analysis/features/types'
import type { Visualization } from '../data'
import { features, spot } from '../sonify/testFeatures'
import { bandWord, describeEvent, eventsBetween, MOVE_CELLS, type EventWords } from './events'

const words = (labels: string[], legend?: 'picture'): EventWords => ({
  mapping: { categories: labels.map((label, i) => ({ id: `c${i}`, label, range: [i, i + 1], note: 'C4' })) } as unknown as Visualization['mapping'],
  legend,
})
const warm = words(['Cold', 'Cool', 'Hot'])

const at = (hotspots: Hotspot[]) => features({ hotspots })

describe('eventsBetween', () => {
  it('reports nothing for the first frame of a run, or when nothing changed', () => {
    expect(eventsBetween(null, at([spot('h1', 'high', 0.8, 0.2)]))).toEqual([])
    const same = at([spot('h1', 'high', 0.8, 0.2)])
    expect(eventsBetween(same, at([spot('h1', 'high', 0.8, 0.2)]))).toEqual([])
  })

  it('reports a spot that is new as appeared, with its place', () => {
    const events = eventsBetween(at([]), at([spot('h1', 'high', 0.8, 0.2)]))
    expect(events).toEqual([{ kind: 'appeared', id: 'h1', band: 'high', place: 'north-east' }])
    expect(describeEvent(events[0], warm)).toBe('A new hot area appeared in the north-east.')
  })

  it('reports a spot that is no longer there as gone, in the place it was', () => {
    const events = eventsBetween(at([spot('h2', 'low', 0.5, 0.9)]), at([]))
    expect(events).toEqual([{ kind: 'gone', id: 'h2', band: 'low', place: 'south' }])
    expect(describeEvent(events[0], warm)).toBe('The cold area in the south has gone.')
  })

  it('reports a spot that moved three cells east as moved, direction east', () => {
    const events = eventsBetween(at([spot('h1', 'high', 0.5, 0.5)]), at([spot('h1', 'high', 0.5 + 3 / 64, 0.5)]))
    expect(events).toEqual([{ kind: 'moved', id: 'h1', band: 'high', place: 'centre', direction: 'east', cells: 3 }])
    expect(describeEvent(events[0], warm)).toBe('The hot area moved east.')
  })

  it('does not call a move of up to the step a move, and names the larger component for the direction', () => {
    expect(eventsBetween(at([spot('h1', 'high', 0.5, 0.5)]), at([spot('h1', 'high', 0.5 + MOVE_CELLS / 64, 0.5)]))).toEqual([])
    const north = eventsBetween(at([spot('h1', 'high', 0.5, 0.5)]), at([spot('h1', 'high', 0.5 + 1 / 64, 0.4)]))
    expect(north.map(e => e.kind === 'moved' && e.direction)).toEqual(['north'])
    const south = eventsBetween(at([spot('h1', 'high', 0.5, 0.5)]), at([spot('h1', 'high', 0.5, 0.6)]))
    expect(south.map(e => e.kind === 'moved' && e.direction)).toEqual(['south'])
    const west = eventsBetween(at([spot('h1', 'high', 0.5, 0.5)]), at([spot('h1', 'high', 0.4, 0.5)]))
    expect(west.map(e => e.kind === 'moved' && e.direction)).toEqual(['west'])
  })

  it('reports a spot whose share doubled as grew, and one that halved as shrank', () => {
    const grew = eventsBetween(at([spot('h1', 'high', 0.5, 0.5, 0.02)]), at([spot('h1', 'high', 0.5, 0.5, 0.04)]))
    expect(grew).toEqual([{ kind: 'grew', id: 'h1', band: 'high', place: 'centre' }])
    expect(describeEvent(grew[0], warm)).toBe('The hot area in the centre grew.')
    const shrank = eventsBetween(at([spot('h1', 'high', 0.5, 0.5, 0.04)]), at([spot('h1', 'high', 0.5, 0.5, 0.01)]))
    expect(shrank.map(e => e.kind)).toEqual(['shrank'])
    expect(eventsBetween(at([spot('h1', 'high', 0.5, 0.5, 0.04)]), at([spot('h1', 'high', 0.5, 0.5, 0.05)]))).toEqual([])
  })

  it('says dropout when a frame cannot be read, then recovered, and does not call the spots gone or new', () => {
    const readable = at([spot('h1', 'high', 0.8, 0.2)])
    const unreadable = features({ position: null })
    expect(eventsBetween(readable, unreadable)).toEqual([{ kind: 'dropout' }])
    expect(eventsBetween(unreadable, features({ position: null }))).toEqual([])
    expect(eventsBetween(unreadable, readable)).toEqual([{ kind: 'recovered' }])
    expect(describeEvent({ kind: 'dropout' }, warm)).toBe('There is not enough readable data on this date.')
    expect(describeEvent({ kind: 'recovered' }, warm)).toBe('Readable data is back.')
  })

  it('returns the same list in a fixed order: by hot-spot id, then by kind', () => {
    const before = at([spot('h10', 'high', 0.5, 0.5, 0.02), spot('h2', 'low', 0.2, 0.2, 0.02), spot('h3', 'high', 0.5, 0.5, 0.02)])
    const after = at([spot('h3', 'high', 0.7, 0.5, 0.05), spot('h10', 'high', 0.5, 0.5, 0.02), spot('h4', 'low', 0.2, 0.2, 0.02)])
    const events = eventsBetween(before, after)
    expect(events.map(e => ('id' in e ? `${e.id}:${e.kind}` : e.kind))).toEqual(['h2:gone', 'h3:moved', 'h3:grew', 'h4:appeared'])
    expect(eventsBetween(before, after)).toEqual(events)
  })
})

describe('the words', () => {
  it('uses the data set’s own top category for a high spot and its bottom one for a low spot', () => {
    expect(bandWord('high', words(['Frigid', 'Mild', 'Scorching']))).toBe('scorching')
    expect(bandWord('low', words(['Frigid', 'Mild', 'Scorching']))).toBe('frigid')
    const event = { kind: 'appeared', id: 'h1', band: 'high', place: 'north' } as const
    expect(describeEvent(event, words(['Cold', 'Hot']))).toBe('A new hot area appeared in the north.')
    expect(describeEvent(event, words(['Cold', 'Blazing']))).toBe('A new blazing area appeared in the north.')
  })

  it('calls the bands bright and dark for a picture', () => {
    const picture = words(['Dark', 'Light'], 'picture')
    expect(bandWord('high', picture)).toBe('bright')
    expect(bandWord('low', picture)).toBe('dark')
    expect(describeEvent({ kind: 'appeared', id: 'h1', band: 'high', place: 'south-west' }, picture)).toBe('A new bright area appeared in the south-west.')
  })

  it('never states a number beyond a count of cells or a place', () => {
    const sentences = [
      describeEvent({ kind: 'moved', id: 'h1', band: 'high', place: 'centre', direction: 'west', cells: 3 }, warm),
      describeEvent({ kind: 'grew', id: 'h1', band: 'low', place: 'north-west' }, warm),
      describeEvent({ kind: 'gone', id: 'h1', band: 'low', place: 'south-east' }, warm),
    ]
    for (const sentence of sentences) expect(sentence).not.toMatch(/\d/)
  })
})
