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

/** A labelled range input that shows its value as text and announces it in words. */
export function Slider({ label, value, min, max, step = 1, onChange, describe, disabled }: Props) {
  const id = useId()
  const words = describe ? describe(value) : String(value)
  // How far along the track the value is, for the filled part of the track (styles/components.css).
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div className="ui-slider">
      <label htmlFor={id} className="ui-slider__label">{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={words}
        style={{ '--pct': `${percent}%` } as CSSProperties}
        onChange={event => onChange(Number(event.currentTarget.value))}
      />
      <output htmlFor={id} className="ui-slider__value">{words}</output>
    </div>
  )
}
