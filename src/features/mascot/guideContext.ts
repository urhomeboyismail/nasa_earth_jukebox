// The two contexts behind useMascotGuide() (docs/tickets/JB01-mascot-dock.md). Types and contexts only, so the provider and the hook files each export one kind of thing.

import { createContext } from 'react'

export type Tip = { text: string; mood?: 'alert' }

export type MascotGuide = {
  /** Queue a tip. It is shown and announced only when the user opens Echo's bubble. */
  offerTip(tip: Tip): void
  clearTip(): void
  /** For the tour (JB05): the element Echo should point at, or null. JB01 only stores it. */
  pointAt(selector: string | null): void
}

/** What the dock reads: the tip that is waiting and the place Echo was asked to point at. */
export type MascotGuideState = { tip: Tip | null; target: string | null }

const nothing = () => {}
export const NO_GUIDE: MascotGuide = { offerTip: nothing, clearTip: nothing, pointAt: nothing }

/** Outside the provider, the guide does nothing, so a page works in isolation (as useAnnounce does). */
export const MascotGuideContext = createContext<MascotGuide>(NO_GUIDE)
export const MascotGuideStateContext = createContext<MascotGuideState>({ tip: null, target: null })
