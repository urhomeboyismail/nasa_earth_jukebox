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
})
