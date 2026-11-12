// Holds the tip Echo has been offered and the place it was asked to point at (docs/tickets/JB01-mascot-dock.md).

import { useMemo, useState, type ReactNode } from 'react'
import { MascotGuideContext, MascotGuideStateContext, type MascotGuide, type MascotGuideState, type Tip } from './guideContext'

export function MascotGuideProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MascotGuideState>({ tip: null, target: null })
  // The actions never change, so a page that calls offerTip in an effect does not run again when a tip arrives.
  const guide = useMemo<MascotGuide>(() => ({
    offerTip: (tip: Tip) => setState(previous => ({ ...previous, tip })),
    clearTip: () => setState(previous => (previous.tip ? { ...previous, tip: null } : previous)),
    pointAt: (selector: string | null) => setState(previous => (previous.target === selector ? previous : { ...previous, target: selector })),
  }), [])
  return (
    <MascotGuideContext.Provider value={guide}>
      <MascotGuideStateContext.Provider value={state}>{children}</MascotGuideStateContext.Provider>
    </MascotGuideContext.Provider>
  )
}
