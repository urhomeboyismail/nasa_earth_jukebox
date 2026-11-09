import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed' | 'aria-label' | 'children'> & {
  /** Required: an icon has no text, so this is the button's only name. Keep it fixed when the button is a toggle. */
  'aria-label': string
  /** The icon, usually an `aria-hidden` 24 px SVG. */
  children: ReactNode
  /** Makes this a toggle: true is on, false is off. On, it turns from round to square. */
  pressed?: boolean
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined'
}

/** A round 48 × 48 px button that shows only an icon. */
export function IconButton({ pressed, variant = 'standard', className, type = 'button', ...rest }: Props) {
  const classes = ['ui-icon-button', `ui-icon-button--${variant}`, className].filter(Boolean).join(' ')
  return <button {...rest} type={type} className={classes} aria-pressed={pressed} />
}
