import type { ReactNode } from 'react'

type Props = {
  variant?: 'info' | 'error'
  children: ReactNode
}

/** A message. An error is announced at once (role alert) and starts with the word "Error", so color is never the only cue. */
export function Notice({ variant = 'info', children }: Props) {
  return (
    <div className={`ui-notice ui-notice--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      {variant === 'error' && <strong className="ui-notice__label">Error: </strong>}
      {children}
    </div>
  )
}
