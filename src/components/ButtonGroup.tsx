import { useId, type ReactNode } from 'react'

type Standard = {
  type?: 'standard'
  /** Names the group for screen readers, for example "Playback". */
  label: string
  /** `Button`s. Pressing one widens it while its neighbors give way. */
  children: ReactNode
}

type Option<T extends string> = { value: T; label: string; disabled?: boolean }

type Connected<T extends string> = {
  type: 'connected'
  /** The question the choice answers, for example "Speed". */
  legend: string
  /** Hide the legend when a visible heading already says the same thing. Screen readers still hear it. */
  hideLegend?: boolean
  options: readonly Option<T>[]
  /** The chosen value, or null when nothing is chosen yet. */
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
  /** The radios' name. One is made up if you leave it out. */
  name?: string
}

const CHECK = 'm9.55 18l-5.7-5.7l1.425-1.425L9.55 15.15l9.175-9.175L20.15 7.4z'

/**
 * A row of related buttons (Material 3 Expressive).
 *
 * - `type="standard"` groups ordinary `Button`s under one label.
 * - `type="connected"` is a single choice. It is built on native radio inputs, so it is announced as a radio group,
 *   arrow keys move the choice, and the chosen segment shows a check mark as well as a different color and shape.
 */
export function ButtonGroup<T extends string>(props: Standard | Connected<T>) {
  const generatedName = useId()
  if (props.type !== 'connected') {
    return (
      <div className="ui-button-group ui-button-group--standard" role="group" aria-label={props.label}>
        <div className="ui-button-group__items">{props.children}</div>
      </div>
    )
  }

  const { legend, hideLegend, options, value, onChange, disabled, name = generatedName } = props
  return (
    <fieldset className="ui-button-group ui-button-group--connected" disabled={disabled}>
      <legend className={hideLegend ? 'ui-visually-hidden' : 'ui-button-group__legend'}>{legend}</legend>
      <div className="ui-button-group__items">
        {options.map(option => (
          <label key={option.value} className="ui-segment">
            <input type="radio" name={name} value={option.value} checked={value === option.value} disabled={option.disabled}
              onChange={() => onChange(option.value)} />
            <svg className="ui-segment__check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={CHECK} /></svg>
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
