// The Night/Day theme (UI01). Night is the default. The choice is kept on this device (and in memory for this visit when storage is
// blocked), and set as data-theme on <html>, which tokens.css reads. applyStoredTheme runs before the first render, so a returning
// visitor who chose Day does not see a flash of Night.

import { useEffect } from 'react'
import { readStored, useStoredValue } from './useStoredValue'

export type Theme = 'night' | 'day'

export const THEME_KEY = 'earth-jukebox:theme'

const parse = (text: string): Theme => (text === 'day' ? 'day' : 'night')

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

/** Called once at start-up, before React renders. */
export function applyStoredTheme() {
  applyTheme(readStored(THEME_KEY, parse, 'night'))
}

/** The theme now, and a function to choose one. Keeps <html> in step with it while a component uses it. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, set] = useStoredValue<Theme>(THEME_KEY, parse, 'night')
  useEffect(() => applyTheme(theme), [theme])
  return [theme, set]
}
