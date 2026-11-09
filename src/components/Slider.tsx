import { useId, type CSSProperties } from 'react'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** The value in words, for example "March 2024: warm". Screen readers read this instead of the bare number. */
  describe?: (value: number) => string
  disabled?: boolean
}

/**
 * A labelled range input that shows its value as text and announces it in words. It looks like the Material 3
 * Expressive slider: two tracks with a gap around a tall handle, and a value indicator while it is in use.
 */
export function Slider({ label, value, min, max, step = 1, onChange, describe, disabled }: Props) {
  const id = useId()
  const words = describe ? describe(value) : String(value)
  // How far along the handle is, from 0 to 1. The CSS draws the two tracks and places the indicator from it.
  const fill = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0
  return (
    <div className="ui-slider" style={{ '--ui-fill': fill } as CSSProperties}>
      <label htmlFor={id} className="ui-slider__label">{label}</label>
      <div className="ui-slider__control">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={words}
          onChange={event => onChange(Number(event.currentTarget.value))}
        />
        {/* Drawn from the attribute, so it isn't a second copy of the value for screen readers or text searches. */}
        <span className="ui-slider__indicator" data-value={words} aria-hidden="true" />
      </div>
      <output htmlFor={id} className="ui-slider__value">{words}</output>
    </div>
  )
}
