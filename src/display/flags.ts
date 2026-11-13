// VIS2: the display settings a listener can switch on. The names and defaults live in this one list. They change how things
// look and never what is read or sounded.

export type DisplayFlags = { readable: boolean; highContrast: boolean; patterns: boolean }
export type DisplayFlag = keyof DisplayFlags

export const DISPLAY_FLAGS: readonly { key: DisplayFlag; label: string; className: string; default: boolean }[] = [
  { key: 'readable', label: 'Easier reading font', className: 'display-readable', default: false },
  { key: 'highContrast', label: 'High contrast', className: 'display-high-contrast', default: false },
  { key: 'patterns', label: 'Colour-vision patterns', className: 'display-patterns', default: false },
]

export const DEFAULT_FLAGS: DisplayFlags = { readable: false, highContrast: false, patterns: false }

export const DISPLAY_STORAGE_KEY = 'earth-jukebox:display'
