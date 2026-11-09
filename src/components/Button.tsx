import type { ButtonHTMLAttributes } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  /** Makes this a toggle: true is on, false is off. Leave undefined for an ordinary button. */
  pressed?: boolean
  /**
   * The Material 3 Expressive button styles. "primary" (filled) and "secondary" (outlined) are the original names and
   * still work, so pages don't have to change.
   */
  variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated' | 'primary' | 'secondary'
  /** "small" is the everyday button (48 px target). "medium" and "large" are for the one main action on a screen. */
  size?: 'small' | 'medium' | 'large'
}

/** A button at least 48 × 48 px. With `pressed` it is a toggle, announced as "pressed" or "not pressed". */
export function Button({ pressed, variant = 'secondary', size = 'small', className, type = 'button', ...rest }: Props) {
  const classes = ['ui-button', `ui-button--${variant}`, size !== 'small' && `ui-button--${size}`, className].filter(Boolean).join(' ')
  return <button {...rest} type={type} className={classes} aria-pressed={pressed} />
}
