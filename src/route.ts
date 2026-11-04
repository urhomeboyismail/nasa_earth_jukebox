// The current page lives in the URL hash: "#listen", "#compare", or "#compare?test=1" for listening-test mode (T13).
// "?data=<id>" names the data set (T54); every link the app builds carries it along.

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

/** "#listen", or "#listen?data=synthetic-ocean" when a data set is chosen. Empty and missing parameters are left out. */
export function hashFor(page: Page, params: Record<string, string | null | undefined> = {}): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
  const text = query.toString()
  return text ? `#${page}?${text}` : `#${page}`
}

/** The data set named in the address right now, or null. Links built while rendering use it so a choice survives a click. */
export function currentDataParam(): string | null {
  return parseHash(window.location.hash).params.get('data')
}
