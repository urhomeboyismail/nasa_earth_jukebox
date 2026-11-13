import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button, useAnnounce } from '../components'
import { DISPLAY_FLAGS, type DisplayFlags } from './flags'
import { DisplaySettingsContext, startingFlags, useDisplaySettings, writeStoredFlags, type DisplaySettings } from './useDisplaySettings'

/** One provider near the root. It keeps the settings, saves them, and puts the three classes on the page. */
export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const announce = useAnnounce()
  const [flags, setFlags] = useState<DisplayFlags>(() => startingFlags())
  const current = useRef(flags)

  useEffect(() => {
    current.current = flags
    for (const flag of DISPLAY_FLAGS) document.documentElement.classList.toggle(flag.className, flags[flag.key])
  }, [flags])

  const setDisplay = useCallback((changes: Partial<DisplayFlags>) => {
    const next = { ...current.current, ...changes }
    current.current = next
    setFlags(next)
    writeStoredFlags(next)
    for (const flag of DISPLAY_FLAGS) {
      if (changes[flag.key] !== undefined) announce(`${flag.label} ${next[flag.key] ? 'on' : 'off'}.`)
    }
  }, [announce])

  const reset = useCallback(() => {
    const next = startingFlags(false)
    current.current = next
    setFlags(next)
    writeStoredFlags(null)
    announce('Display settings reset.')
  }, [announce])

  const value = useMemo<DisplaySettings>(() => ({ flags, setDisplay, reset }), [flags, setDisplay, reset])
  return <DisplaySettingsContext.Provider value={value}>{children}</DisplaySettingsContext.Provider>
}

/** The "Display" button for the header, and the panel it opens: three switches and "Reset display". Escape closes it and gives focus back. */
export function DisplayButton() {
  const { flags, setDisplay, reset } = useDisplaySettings()
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const panel = useId()

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    setOpen(false)
    toggle.current?.focus()
  }

  return (
    <div className="display-control" onKeyDown={onKeyDown}>
      <button ref={toggle} type="button" className="display-control__button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>
        Display
      </button>
      <div id={panel} className="display-control__panel" role="group" aria-label="Display settings" hidden={!open}>
        {DISPLAY_FLAGS.map(flag => (
          <label key={flag.key} className="display-control__switch">
            <input type="checkbox" role="switch" checked={flags[flag.key]} onChange={event => setDisplay({ [flag.key]: event.target.checked })} />
            <span>{flag.label}</span>
          </label>
        ))}
        <Button onClick={reset}>Reset display</Button>
      </div>
    </div>
  )
}
