import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { FrameGrid } from '../analysis'
import { useEnsemble } from '../audio/ensemble/useEnsemble'
import type { ColorScale, RGB, SoundMapping, Visualization } from '../data'
import { useDisplaySettings } from '../display/useDisplaySettings'
import { createProbeAudio } from '../features/explore/probeAudio'
import { presetFor } from '../sonify/presets'
import { colourAt } from './colourAt'
import { useAnnounce } from './useAnnounce'
import { PatternSwatch } from './PatternLayer'

type Props = {
  colorScale: ColorScale
  mapping: SoundMapping
  variable: Visualization['variable']
}

const css = (rgb: RGB) => `rgb(${rgb.join(', ')})`

/** The legend bar: each stop's colour placed where its value falls between the lowest and the highest. */
function gradient(colorScale: ColorScale): string {
  const stops = [...colorScale.stops].sort((a, b) => a.value - b.value)
  const [low, high] = [stops[0].value, stops[stops.length - 1].value]
  if (high === low) return css(stops[0].rgb)
  const placed = stops.map(stop => `${css(stop.rgb)} ${Math.round(((stop.value - low) / (high - low)) * 1000) / 10}%`)
  return `linear-gradient(to right, ${placed.join(', ')})`
}

// JB07: the legend is playable. Hovering or focusing a category sounds its tone through the explorer's probe (the same pitch the map gives that
// value) and says its label and range. The legend has its own small ensemble, which loads nothing until a click or key press starts it.
const PRESET = presetFor('major')

/** A grid of one cell holding `value`, so the probe sounds it as the map would. */
function oneCell(value: number, category: string): FrameGrid {
  return { frameId: 'legend', cols: 1, rows: 1, area: { x0: 0, y0: 0, x1: 1, y1: 1 }, cells: [{ value, category }] }
}

/** True when focus came from the keyboard (or the browser cannot tell, which is the safer guess for a keyboard user). */
function focusedByKeyboard(element: HTMLElement): boolean {
  try { return element.matches(':focus-visible') } catch { return true }
}

/**
 * The key to the image's colours, for the colours as text too: how far the colours run, then each sound category with
 * the range it covers and the colour the legend gives it. The colours are decoration; the words carry the meaning.
 */
export function Legend({ colorScale, mapping, variable }: Props) {
  const values = colorScale.stops.map(stop => stop.value)
  const unit = variable.unit ? ` ${variable.unit}` : ''
  const { patterns } = useDisplaySettings().flags
  const ids = mapping.categories.map(category => category.id)
  const announce = useAnnounce()
  const { ensemble } = useEnsemble(PRESET, 'full')
  const probe = useMemo(() => createProbeAudio(ensemble, PRESET), [ensemble])
  useEffect(() => () => probe.dispose(), [probe])
  /** The category that takes Tab (roving), the items for the arrow keys, and the middle value last sounded, for "higher" or "lower". */
  const [current, setCurrent] = useState(0)
  const items = useRef<(HTMLLIElement | null)[]>([])
  const lastValue = useRef<number | null>(null)
  /** An arrow key is moving focus: that focus is the listener's key press, wherever the browser says it came from. */
  const movedByKey = useRef(false)

  function play(index: number) {
    const category = mapping.categories[index]
    const [from, to] = category.range
    const value = (from + to) / 2
    probe.setMap({ grid: oneCell(value, category.id), colorScale, slopeCue: false })
    probe.point(0, 0)
    const before = lastValue.current
    lastValue.current = value
    const pitch = before === null || before === value ? '' : `, ${value > before ? 'higher' : 'lower'} pitch`
    announce(`${category.label}: ${from} to ${to}${unit}${pitch}`, { busy: true })
  }

  function onKeyDown(event: KeyboardEvent<HTMLLIElement>, index: number) {
    probe.start()
    const last = mapping.categories.length - 1
    const target = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: last }[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = Math.min(last, Math.max(0, target))
    setCurrent(next)
    movedByKey.current = true
    items.current[next]?.focus()
    movedByKey.current = false
  }
  return (
    <div className="ui-legend">
      <div className="ui-legend__bar" style={{ background: gradient(colorScale) }} aria-hidden="true" />
      <p className="ui-legend__summary">{`Colours run from ${Math.min(...values)}${unit} (left) to ${Math.max(...values)}${unit} (right).`}</p>
      <ul className="ui-legend__list">
        {mapping.categories.map((category, index) => {
          const [from, to] = category.range
          return (
            <li key={category.id} aria-label={`${category.label}: ${from} to ${to}${unit}`} ref={element => { items.current[index] = element }} tabIndex={index === current ? 0 : -1}
              onFocus={event => { setCurrent(index); if (movedByKey.current || focusedByKeyboard(event.currentTarget)) { probe.start(); play(index) } }}
              onBlur={probe.leave}
              onKeyDown={event => onKeyDown(event, index)}
              onPointerEnter={() => { if (ensemble.status() === 'on') play(index) }}
              onPointerLeave={probe.leave}
              onPointerDown={() => { const sounding = ensemble.status() === 'on'; probe.start(); if (!sounding) play(index) }}>
              <span className="ui-legend__swatch" style={{ background: css(colourAt(colorScale, (from + to) / 2)) }} aria-hidden="true">
                {patterns && <PatternSwatch category={category.id} categoryIds={ids} />}
              </span>
              <span><strong>{category.label}</strong>: {from} to {to}{unit}</span>
            </li>
          )
        })}
        {patterns && (
          <li>
            <span className="ui-legend__swatch" aria-hidden="true"><PatternSwatch category="insufficient" categoryIds={ids} /></span>
            <span><strong>Not enough data</strong></span>
          </li>
        )}
      </ul>
    </div>
  )
}
