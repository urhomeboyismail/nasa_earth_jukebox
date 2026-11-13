import { describe, expect, it } from 'vitest'
import type { Visualization } from '../data'
import { features, spot } from '../sonify/testFeatures'
import { hotspotMarkers } from './markers'

const words = { mapping: { categories: [{ id: 'a', label: 'Cold', range: [0, 1], note: 'C4' }, { id: 'b', label: 'Warm', range: [1, 2], note: 'D4' }] } as unknown as Visualization['mapping'] }

describe('hotspotMarkers', () => {
  it('makes one marker per hot spot, at its centre, in the extractor’s order', () => {
    const f = features({ hotspots: [spot('h1', 'high', 0.8, 0.2, 0.04), spot('h2', 'low', 0.3, 0.7, 0.01)] })
    const markers = hotspotMarkers(f)
    expect(markers.map(m => [m.id, m.band, m.x, m.y])).toEqual([['h1', 'high', 0.8, 0.2], ['h2', 'low', 0.3, 0.7]])
  })

  it('labels each with its place and its share of the map', () => {
    const f = features({ hotspots: [spot('h1', 'high', 0.8, 0.2, 0.04), spot('h2', 'low', 0.3, 0.7, 0.001)] })
    expect(hotspotMarkers(f).map(m => m.label)).toEqual([
      'High area h1 in the north-east, about 4% of the map.',
      'Low area h2 in the south-west, less than 1% of the map.',
    ])
  })

  it('uses the data set’s own words for the bands when it is given them', () => {
    const f = features({ hotspots: [spot('h1', 'high', 0.5, 0.5, 0.1)] })
    expect(hotspotMarkers(f, words)[0].label).toBe('Warm area h1 in the centre, about 10% of the map.')
  })

  it('is empty for a frame with no hot spots', () => {
    expect(hotspotMarkers(features())).toEqual([])
  })
})
