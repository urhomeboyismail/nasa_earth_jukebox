import { describe, expect, it } from 'vitest'
import { primaryRegion, regionFor } from './regions'
import type { Region } from './types'

const region = (id: string): Region => ({ id, name: `Region ${id}`, description: '', points: [{ x: 0.5, y: 0.5 }] })
const data = { regions: [region('first'), region('second')] }

describe('primaryRegion', () => {
  it('is the first region in the manifest', () => {
    expect(primaryRegion(data).id).toBe('first')
  })
})

describe('regionFor', () => {
  it('returns the region with that id', () => {
    expect(regionFor(data, 'second').id).toBe('second')
  })

  it('returns the primary region when the id is missing', () => {
    expect(regionFor(data, null).id).toBe('first')
    expect(regionFor(data, undefined).id).toBe('first')
    expect(regionFor(data, '').id).toBe('first')
  })

  it('returns the primary region when the data set has no such region', () => {
    expect(regionFor(data, 'nowhere').id).toBe('first')
  })
})
