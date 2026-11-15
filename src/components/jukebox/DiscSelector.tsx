import * as RadioGroup from '@radix-ui/react-radio-group'
import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import type { CatalogEntry } from '../../data'
import { useNowPlaying } from './nowPlaying'
import './DiscSelector.css'

type Family = NonNullable<CatalogEntry['family']>

type Props = {
  catalog: CatalogEntry[]
  /** The id of the data set that is showing. */
  value: string
  onChange: (id: string) => void
  /** What the group is called, for the label above it and for screen readers. */
  label?: string
}

/** A record: grooves, a paper label in the data set's family colour and, when `print` is set, the label's printed ring. Decorative; the name is on the button around it. */
function Disc({ family, spinning, print }: { family: Family; spinning?: boolean; print?: boolean }) {
  const ring = useId()
  return (
    <span className="disc" data-family={family} data-spinning={spinning} aria-hidden="true">
      <span className="disc__spin">
        <span className="disc__grooves" />
        <span className="disc__label">
          {print && (
            <svg className="disc__print" viewBox="0 0 100 100">
              <path id={ring} d="M 50 50 m -33 0 a 33 33 0 1 1 66 0 a 33 33 0 1 1 -66 0" fill="none" />
              <text><textPath href={`#${ring}`}>EARTH JUKEBOX · {family.toUpperCase()} · SIDE A ·</textPath></text>
            </svg>
          )}
        </span>
      </span>
      <span className="disc__sheen" />
    </span>
  )
}

/**
 * Listen's choice of data set, as a turntable: the chosen record sits on the platter (it spins and the tonearm lands while sound plays),
 * and the records in the crate below are a radio group, so the arrow keys move between them like the old list did.
 */
export function DiscSelector({ catalog, value, onChange, label = 'Data set' }: Props) {
  const id = useId()
  const playing = useNowPlaying()
  const current = catalog.find(entry => entry.id === value)
  const family = current?.family ?? 'ocean'

  // Keeps the checked record in view in the crate (it may be far along it), by moving the crate and never the page.
  const crate = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = crate.current
    const item = box?.querySelector('[role=radio][data-state=checked]')
    if (!box || !item) return
    box.scrollLeft += item.getBoundingClientRect().left - box.getBoundingClientRect().left - (box.clientWidth - item.clientWidth) / 2
  }, [value])

  // Radix only chooses the disc it moves to while the arrow key is still down, so a key that goes up at once (a switch, a screen reader) would move
  // focus and choose nothing. Choosing here makes the arrows always choose. Radix still moves the focus.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    const from = event.target instanceof HTMLElement ? event.target.closest('[role=radio]')?.getAttribute('value') : null
    const at = catalog.findIndex(entry => entry.id === from)
    if (step && at >= 0) onChange(catalog[(at + step + catalog.length) % catalog.length].id)
  }

  return (
    <div className="disc-selector" data-tour="dataset-picker">
      <span id={`${id}-label`} className="ui-picker__label">{label}</span>
      <div className="disc-platter ui-glass" data-playing={playing} aria-hidden="true">
        <span className="disc-platter__mat" />
        <Disc family={family} spinning={playing} print />
        <span className="disc-platter__arm"><span className="disc-platter__head" /></span>
      </div>
      <RadioGroup.Root ref={crate} className="disc-crate" value={value} onValueChange={onChange} onKeyDown={onKeyDown} orientation="horizontal"
        aria-labelledby={`${id}-label`} aria-describedby={current ? `${id}-summary` : undefined}>
        {catalog.map(entry => (
          <RadioGroup.Item key={entry.id} value={entry.id} className="disc-crate__item">
            <Disc family={entry.family ?? 'ocean'} />
            <span className="disc-crate__name">{entry.title}</span>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {current && <p id={`${id}-summary`} className="ui-picker__summary"><strong>{current.title}.</strong> {current.summary}</p>}
    </div>
  )
}
