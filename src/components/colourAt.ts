import type { ColorScale, RGB } from '../data'

/** The legend colour for a value: the stops' colours blended in proportion, and the end colours beyond the legend. */
export function colourAt(colorScale: ColorScale, value: number): RGB {
  const stops = [...colorScale.stops].sort((a, b) => a.value - b.value)
  const last = stops[stops.length - 1]
  if (value <= stops[0].value) return stops[0].rgb
  if (value >= last.value) return last.rgb
  const upper = stops.findIndex(stop => stop.value >= value)
  const [below, above] = [stops[upper - 1], stops[upper]]
  const t = (value - below.value) / (above.value - below.value)
  const mix = (channel: 0 | 1 | 2) => Math.round(below.rgb[channel] + (above.rgb[channel] - below.rgb[channel]) * t)
  return [mix(0), mix(1), mix(2)]
}
