import type { ColorScale, RGB, SoundMapping, Visualization } from '../data'
import { useDisplaySettings } from '../display/useDisplaySettings'
import { colourAt } from './colourAt'
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

/**
 * The key to the image's colours, for the colours as text too: how far the colours run, then each sound category with
 * the range it covers and the colour the legend gives it. The colours are decoration; the words carry the meaning.
 */
export function Legend({ colorScale, mapping, variable }: Props) {
  const values = colorScale.stops.map(stop => stop.value)
  const unit = variable.unit ? ` ${variable.unit}` : ''
  const { patterns } = useDisplaySettings().flags
  const ids = mapping.categories.map(category => category.id)
  return (
    <div className="ui-legend">
      <div className="ui-legend__bar" style={{ background: gradient(colorScale) }} aria-hidden="true" />
      <p className="ui-legend__summary">{`Colours run from ${Math.min(...values)}${unit} (left) to ${Math.max(...values)}${unit} (right).`}</p>
      <ul className="ui-legend__list">
        {mapping.categories.map(category => {
          const [from, to] = category.range
          return (
            <li key={category.id}>
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
