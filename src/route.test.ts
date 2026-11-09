import { afterEach, describe, expect, it, vi } from 'vitest'
import { pages } from './pages'
import { cellParam, hashFor, parseCell, parseHash, parseStyleParam, replaceParams, withParams } from './route'

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

describe('parseCell and cellParam (F40)', () => {
  it('reads "col,row" and writes it back', () => {
    expect(parseCell('3,5')).toEqual({ col: 3, row: 5 })
    expect(parseCell('0,0')).toEqual({ col: 0, row: 0 })
    expect(cellParam({ col: 3, row: 5 })).toBe('3,5')
    expect(parseCell(cellParam({ col: 12, row: 6 }))).toEqual({ col: 12, row: 6 })
  })

  it('ignores anything that is not two whole numbers', () => {
    for (const bad of [null, '', '3', '3,', ',5', '-1,2', '1.5,2', 'a,b', '1,2,3', ' 1,2', '99999,1', '3;5']) expect(parseCell(bad)).toBeNull()
  })

  it('leaves the parameter out when there is no cell', () => {
    expect(cellParam(null)).toBeNull()
  })
})

describe('parseStyleParam (F40)', () => {
  it('knows the three sound styles', () => {
    for (const style of ['full', 'simple', 'change'] as const) expect(parseStyleParam(style)).toBe(style)
  })

  it('ignores a style that does not exist, in any case', () => {
    for (const bad of [null, '', 'loud', 'Full', 'CHANGE', 'full ']) expect(parseStyleParam(bad)).toBeNull()
  })
})

describe('withParams (F40)', () => {
  it('sets parameters and keeps the ones it is not told about', () => {
    const next = withParams('#listen?data=synthetic-ocean&test=1', { date: '2024-01-15', cell: '3,5' })
    const route = parseHash(next)
    expect(route.page).toBe('listen')
    expect(route.params.get('data')).toBe('synthetic-ocean')
    expect(route.params.get('test')).toBe('1')
    expect(route.params.get('date')).toBe('2024-01-15')
    expect(parseCell(route.params.get('cell'))).toEqual({ col: 3, row: 5 })
  })

  it('removes a parameter set to null, and replaces one that is there', () => {
    const next = withParams('#listen?data=a&cell=1,1&date=2024-01-15', { cell: null, date: '2024-07-15' })
    const route = parseHash(next)
    expect(route.params.has('cell')).toBe(false)
    expect(route.params.get('date')).toBe('2024-07-15')
    expect(route.params.get('data')).toBe('a')
  })

  it('works from an address with no query, and from no address at all', () => {
    expect(withParams('#listen', { style: 'simple' })).toBe('#listen?style=simple')
    expect(parseHash(withParams('', { style: 'simple' }))).toMatchObject({ page: 'home', known: true })
  })

  it('leaves an unknown page alone', () => {
    expect(withParams('#nope', { date: '2024-01-15' })).toBe('#nope')
  })
})

describe('replaceParams (F40)', () => {
  afterEach(() => { window.history.replaceState(null, '', '/') })

  it('changes the address without adding a history entry', () => {
    window.history.replaceState(null, '', '#listen?data=fixture')
    const before = window.history.length
    replaceParams({ date: '2024-07-15' })
    expect(window.location.hash).toBe('#listen?data=fixture&date=2024-07-15')
    expect(window.history.length).toBe(before)
  })

  it('does not fire "hashchange", so the app does not treat it as a link being opened', () => {
    window.history.replaceState(null, '', '#listen')
    const heard = vi.fn()
    window.addEventListener('hashchange', heard)
    replaceParams({ date: '2024-07-15' })
    window.removeEventListener('hashchange', heard)
    expect(heard).not.toHaveBeenCalled()
  })

  it('does nothing when the address would not change', () => {
    window.history.replaceState(null, '', '#listen?date=2024-07-15')
    const spy = vi.spyOn(window.history, 'replaceState')
    replaceParams({ date: '2024-07-15' })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
