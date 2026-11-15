import { describe, expect, it } from 'vitest'
import type { ManifestEvent } from '../data/types'
import { EVENT_CUE_GAP_S, EVENT_CUE_LEVEL, eventCues, eventSentence, eventsBetween, MAX_EVENT_CUES } from './events'

const storm: ManifestEvent = { id: 'storm', date: '2023-08-20', label: 'A storm forms', place: { x: 0.9, y: 0.5 } }
const peak: ManifestEvent = { id: 'peak', date: '2023-08-25', label: 'The warmest day' }
const late: ManifestEvent = { id: 'late', date: '2023-09-30', label: 'The season calms', place: { x: 0.1, y: 0.1 } }
const all = [late, storm, peak]

describe('eventsBetween (SN17)', () => {
  it('gives the events after the last date and up to this one, in date order', () => {
    expect(eventsBetween(all, '2023-08-15', '2023-08-25').map(e => e.id)).toEqual(['storm', 'peak'])
    expect(eventsBetween(all, '2023-08-20', '2023-08-25').map(e => e.id)).toEqual(['peak'])
  })

  it('gives none on the first frame, when the dates go backwards, or when nothing falls between', () => {
    expect(eventsBetween(all, null, '2023-08-25')).toEqual([])
    expect(eventsBetween(all, '2023-09-01', '2023-08-01')).toEqual([])
    expect(eventsBetween(all, '2023-09-01', '2023-09-10')).toEqual([])
  })
})

describe('eventCues (SN17)', () => {
  it('pans each cue by the event\'s place, centre without one, and keeps it quiet', () => {
    const [a, b] = eventCues([storm, peak])
    expect(a.offsetS).toBe(0)
    expect(b.offsetS).toBe(EVENT_CUE_GAP_S)
    expect(a.notes.every(n => Math.abs(n.pan - 0.8) < 1e-9 && n.level === EVENT_CUE_LEVEL)).toBe(true)
    expect(b.notes.every(n => n.pan === 0)).toBe(true)
  })

  it('sounds at most MAX_EVENT_CUES cues, and the same events always give the same cues', () => {
    expect(eventCues(all)).toHaveLength(MAX_EVENT_CUES)
    expect(eventCues(all)).toEqual(eventCues(all))
  })
})

describe('eventSentence (SN17)', () => {
  it('names the event and where it is, or every event on the frame', () => {
    expect(eventSentence([storm])).toBe('Event: A storm forms, east.')
    expect(eventSentence([peak])).toBe('Event: The warmest day.')
    expect(eventSentence([storm, late])).toBe('Events: A storm forms, east; The season calms, north-west.')
  })
})
