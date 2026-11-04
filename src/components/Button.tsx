import type { ButtonHTMLAttributes } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  /** Makes this a toggle: true is on, false is off. Leave undefined for an ordinary button. */
  pressed?: boolean
  variant?: 'primary' | 'secondary'
}

/** A button at least 44 × 44 px. With `pressed` it is a toggle, announced as "pressed" or "not pressed". */
export function Button({ pressed, variant = 'secondary', className, type = 'button', ...rest }: Props) {
  const classes = ['ui-button', `ui-button--${variant}`, className].filter(Boolean).join(' ')
  return <button {...rest} type={type} className={classes} aria-pressed={pressed} />
}
