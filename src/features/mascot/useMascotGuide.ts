// How a page talks to Echo (docs/tickets/JB01-mascot-dock.md): `useMascotGuide()` to offer a tip, and `useMascotGuideState()` for the dock to read it.

import { useContext } from 'react'
import { MascotGuideContext, MascotGuideStateContext, type MascotGuide, type MascotGuideState } from './guideContext'

export function useMascotGuide(): MascotGuide {
  return useContext(MascotGuideContext)
}

export function useMascotGuideState(): MascotGuideState {
  return useContext(MascotGuideStateContext)
}
