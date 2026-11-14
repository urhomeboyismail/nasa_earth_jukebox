import type { KeyboardEvent } from 'react'
import * as Slider from '@radix-ui/react-slider'
import './range-slider.css'

type Props = {
  /** The name of each thumb, low then high, for example ["Date A", "Date B"]. */
  labels: readonly [string, string]
  /** Low then high. The thumbs never cross, and are never closer than one step. */
  value: readonly [number, number]
  min: number
  max: number
  /** Called with the new pair and the thumb that moved (0 low, 1 high). */
  onChange: (value: [number, number], thumb: 0 | 1) => void
  /** One value in words, for example "March 2024". Screen readers read this instead of the bare number. */
  describe: (value: number) => string
}

/** Page Up and Down move five steps. */
const PAGE = 5

/**
 * A scrubber with two handles on one track, built on Radix Slider for the ARIA and the arrow keys (one step). Page Up and Down
 * (five steps), Home and End are handled here so a handle can never pass the other. Each handle has its own name and reads its
 * value as text.
 */
export function RangeSlider({ labels, value, min, max, onChange, describe }: Props) {
  function change(next: number[]) {
    const [low, high] = next
    if (low === undefined || high === undefined) return
    const thumb = low !== value[0] ? 0 : 1
    onChange([low, high], thumb)
  }

  /** Where a key takes a thumb, kept between the ends and one step from the other thumb. Null for a key not handled here. */
  function target(index: 0 | 1, key: string): number | null {
    const lowest = index === 0 ? min : value[0] + 1
    const highest = index === 0 ? value[1] - 1 : max
    const here = value[index]
    const to = key === 'Home' ? lowest : key === 'End' ? highest : key === 'PageUp' ? here + PAGE : key === 'PageDown' ? here - PAGE : null
    return to === null ? null : Math.min(Math.max(to, lowest), highest)
  }

  function onKeyDown(index: 0 | 1, event: KeyboardEvent) {
    const to = target(index, event.key)
    if (to === null) return
    // Radix steps ten for the page keys and lets Home and End pass the other thumb, so these four keys are handled here.
    event.preventDefault()
    event.stopPropagation()
    if (to === value[index]) return
    const next: [number, number] = [value[0], value[1]]
    next[index] = to
    onChange(next, index)
  }

  return (
    <Slider.Root
      className="ui-range"
      min={min}
      max={max}
      step={1}
      minStepsBetweenThumbs={1}
      value={[...value]}
      onValueChange={change}
    >
      <Slider.Track className="ui-range__track">
        <Slider.Range className="ui-range__range" />
      </Slider.Track>
      {labels.map((label, index) => {
        const thumb = index === 0 ? 0 : 1
        return (
          <Slider.Thumb
            key={thumb}
            className="ui-range__thumb"
            aria-label={label}
            aria-valuetext={describe(value[thumb])}
            data-value={describe(value[thumb])}
            onKeyDown={event => onKeyDown(thumb, event)}
          />
        )
      })}
    </Slider.Root>
  )
}
