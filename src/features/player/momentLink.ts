// F40: a link to one moment on Listen. The address carries the date, the sound map's cell and the sound style, next to the data set.
// Reading is forgiving: a value that is missing, malformed or not in this data set is ignored and the rest of the link still applies.

import { useEffect, useRef } from 'react'
import type { SoundStyle } from '../../audio/style'
import { cellParam, parseCell, parseHash, parseStyleParam, replaceParams, withParams, type Cell } from '../../route'

/** What the page is showing now. */
export type Moment = { date: string; cell: Cell | null; style: SoundStyle }

/** What a link asks for. A field is null when the link leaves it out or names something this data set does not have. */
export type LinkedMoment = { index: number | null; cell: Cell | null; style: SoundStyle | null }

const NOTHING: LinkedMoment = { index: null, cell: null, style: null }

export const hasMoment = (linked: LinkedMoment) => linked.index !== null || linked.cell !== null || linked.style !== null

/** The moment an address asks for. `dates` are the data set's frame dates, so a date it does not have is dropped. */
export function readMoment(hash: string, dates: readonly string[]): LinkedMoment {
  const route = parseHash(hash)
  if (route.page !== 'listen') return NOTHING
  const index = dates.indexOf(route.params.get('date') ?? '')
  return { index: index >= 0 ? index : null, cell: parseCell(route.params.get('cell')), style: parseStyleParam(route.params.get('style')) }
}

/** The address for a moment: the same page and data set, with the date, cell and style set. The copy button uses it, so the link is whole even before anything has changed. */
export function momentHash(hash: string, moment: Moment): string {
  return withParams(hash, { date: moment.date, cell: cellParam(moment.cell), style: moment.style })
}

/**
 * Keeps the address in step with `moment` once it changes, and calls `onLink` when a link naming a moment is opened while Listen is
 * already showing (pasting it into the same tab fires "hashchange" and nothing else). The first moment is read by the caller, while it
 * renders, and the address is left as it is until something changes: just opening Listen must not rewrite it.
 */
export function useMomentLink(moment: Moment, dates: readonly string[], onLink: (linked: LinkedMoment) => void) {
  const { date, style } = moment
  const cell = cellParam(moment.cell)

  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (parseHash(window.location.hash).page === 'listen') replaceParams({ date, cell, style })
  }, [date, cell, style])

  const onLinkRef = useRef(onLink)
  useEffect(() => { onLinkRef.current = onLink })

  useEffect(() => {
    const follow = () => {
      const linked = readMoment(window.location.hash, dates)
      // A link that names nothing (the Listen tab was pressed again) leaves the page as it is. The address then lacks the moment until the next change; the copy button still builds it whole.
      if (hasMoment(linked)) onLinkRef.current(linked)
    }
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [dates])
}
