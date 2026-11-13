// F41's list of shortcuts moved to src/interaction/shortcuts.ts (ticket IX01), which is now the only list of keys in the app. This file keeps the old import
// path working for the panels that still ask which key is which (Symphony), and for the dialog.

export { SHORTCUTS, keyName, listedShortcuts, shortcutFor, shortcutsFor } from '../../interaction/shortcuts'
export type { Scope, Shortcut, ShortcutId } from '../../interaction/shortcuts'
