import { describe, expect, it } from 'vitest'
import { pages } from './pages'
import { hashFor, parseHash } from './route'

describe('parseHash', () => {
  it('opens each page from its own hash', () => {
    for (const { id } of pages) expect(parseHash(`#${id}`)).toMatchObject({ page: id, known: true })
  })

  it('treats no hash as Home', () => {
    expect(parseHash('')).toMatchObject({ page: 'home', known: true })
    expect(parseHash('#')).toMatchObject({ page: 'home', known: true })
  })

  it('sends unknown hashes to Home and says they were unknown', () => {
    expect(parseHash('#nope')).toMatchObject({ page: 'home', known: false })
    expect(parseHash('#/listen')).toMatchObject({ page: 'home', known: false })
    expect(parseHash('#listen/extra')).toMatchObject({ page: 'home', known: false })
  })

  it('ignores case', () => {
    expect(parseHash('#Compare').page).toBe('compare')
  })

  it('keeps the query, for listening-test mode', () => {
    const route = parseHash('#compare?test=1')
    expect(route.page).toBe('compare')
    expect(route.params.get('test')).toBe('1')
    expect(parseHash('#compare').params.has('test')).toBe(false)
  })

  it('does not keep a query from an unknown page', () => {
    expect(parseHash('#nope?test=1').params.has('test')).toBe(false)
  })
})

describe('hashFor', () => {
  it('round-trips with parseHash', () => {
    for (const { id } of pages) expect(parseHash(hashFor(id)).page).toBe(id)
  })

  it('is just the page when there is nothing to add', () => {
    expect(hashFor('listen')).toBe('#listen')
    expect(hashFor('listen', {})).toBe('#listen')
  })

  it('carries the chosen data set, and parseHash reads it back', () => {
    expect(hashFor('listen', { data: 'synthetic-ocean' })).toBe('#listen?data=synthetic-ocean')
    const route = parseHash(hashFor('compare', { data: 'synthetic-ocean' }))
    expect(route).toMatchObject({ page: 'compare', known: true })
    expect(route.params.get('data')).toBe('synthetic-ocean')
  })

  it('leaves out parameters that are empty or missing', () => {
    expect(hashFor('about', { data: null })).toBe('#about')
    expect(hashFor('about', { data: undefined })).toBe('#about')
    expect(hashFor('about', { data: '' })).toBe('#about')
  })

  it('keeps several parameters together, in a form parseHash reads', () => {
    const route = parseHash(hashFor('compare', { test: '1', data: 'synthetic-ocean' }))
    expect(route.params.get('test')).toBe('1')
    expect(route.params.get('data')).toBe('synthetic-ocean')
  })

  it('escapes anything that would break the address', () => {
    expect(parseHash(hashFor('listen', { data: 'a b&c=d' })).params.get('data')).toBe('a b&c=d')
  })
})
