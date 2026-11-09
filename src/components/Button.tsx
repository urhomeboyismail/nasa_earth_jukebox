import type { ButtonHTMLAttributes } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  /** Makes this a toggle: true is on, false is off. Leave undefined for an ordinary button. */
  pressed?: boolean
  /**
   * `primary` (or its Material name `filled`) is the one main action; `tonal` a quieter one; `secondary` and `outlined` have an
   * outline (`outlined` with accent text); `text` has no container; `elevated` has a shadow. A toggle that is on is filled.
   */
  variant?: 'primary' | 'filled' | 'secondary' | 'tonal' | 'outlined' | 'text' | 'elevated'
  /** `s` is 44 px tall (the touch size), `m` 56 px, `l` 96 px. Leave undefined for the original size, which is `s`. */
  size?: 's' | 'm' | 'l'
  /** The resting corner. Round is the default; a pressed toggle swaps to the other shape, and a press morphs towards a smaller corner. */
  shape?: 'round' | 'square'
}

/** A button at least 44 × 44 px. With `pressed` it is a toggle, announced as "pressed" or "not pressed". */
export function Button({ pressed, variant = 'secondary', size, shape, className, type = 'button', ...rest }: Props) {
  const classes = [
    'ui-button',
    `ui-button--${variant === 'filled' ? 'primary' : variant}`,
    size && size !== 's' && `ui-button--${size}`,
    shape === 'square' && 'ui-button--square',
    className,
  ].filter(Boolean).join(' ')
  return <button {...rest} type={type} className={classes} aria-pressed={pressed} />
}
