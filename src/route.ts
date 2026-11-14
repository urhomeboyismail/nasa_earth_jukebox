// The current page lives in the URL hash: "#listen", "#compare", or "#compare?test=1" for listening-test mode (T13).
// "?data=<id>" names the data set (T54); every link the app builds carries it along.

import type { SoundStyle } from './audio/style'
import { isPage, type Page } from './pages'

export type Route = {
  page: Page
  /** The part after "?", e.g. test=1. */
  params: URLSearchParams
  /** False when the hash named a page that does not exist, so the caller can tidy the address. */
  known: boolean
}

export function parseHash(hash: string): Route {
  const [name, query = ''] = hash.replace(/^#/, '').split('?', 2)
  const params = new URLSearchParams(query)
  if (name === '') return { page: 'home', params, known: true }
  const page = name.toLowerCase()
  return isPage(page) ? { page, params, known: true } : { page: 'home', params: new URLSearchParams(), known: false }
}

/** The landing view (#welcome) is not a page: it has no tab and no entry in `pages`. A first visit with no address opens on it. */
export const LANDING_HASH = '#welcome'
export const isLandingHash = (hash: string): boolean => hash.replace(/^#/, '').split('?', 1)[0].toLowerCase() === 'welcome'

/** "#listen", or "#listen?data=synthetic-ocean" when a data set is chosen. Empty and missing parameters are left out. */
export function hashFor(page: Page, params: Record<string, string | null | undefined> = {}): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
  const text = query.toString()
  return text ? `#${page}?${text}` : `#${page}`
}

/** A place on the sound map (F40). */
export type Cell = { col: number; row: number }

/** "3,5" is column 3, row 5. Anything else (missing, negative, fractional, extra parts) is null. */
export function parseCell(value: string | null): Cell | null {
  const match = /^(\d{1,4}),(\d{1,4})$/.exec(value ?? '')
  return match ? { col: Number(match[1]), row: Number(match[2]) } : null
}

export const cellParam = (cell: Cell | null): string | null => (cell ? `${cell.col},${cell.row}` : null)

const STYLES = ['full', 'simple', 'change'] as const satisfies readonly SoundStyle[]

/** The sound style a link names, or null if it names none that exists. */
export function parseStyleParam(value: string | null): SoundStyle | null {
  return STYLES.find(style => style === value) ?? null
}

/** The same address with these parameters set (a string) or removed (null). Other parameters, such as data and test, stay. An unknown page is left alone. */
export function withParams(hash: string, updates: Record<string, string | null>): string {
  const route = parseHash(hash)
  if (!route.known) return hash
  for (const [key, value] of Object.entries(updates)) {
    if (value) route.params.set(key, value)
    else route.params.delete(key)
  }
  return hashFor(route.page, Object.fromEntries(route.params))
}

/** Rewrites the address in place, without a new history entry, so Back still leaves the page. It does not fire "hashchange". */
export function replaceParams(updates: Record<string, string | null>): void {
  const next = withParams(window.location.hash, updates)
  if (next !== window.location.hash) window.history.replaceState(window.history.state, '', next)
}

/** The data set named in the address right now, or null. Links built while rendering use it so a choice survives a click. */
export function currentDataParam(): string | null {
  return parseHash(window.location.hash).params.get('data')
}
