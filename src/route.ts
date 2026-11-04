// The current page lives in the URL hash: "#listen", "#compare", or "#compare?test=1" for listening-test mode (T13).

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

export function hashFor(page: Page): string {
  return `#${page}`
}
