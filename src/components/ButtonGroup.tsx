import type { ReactNode } from 'react'

type Props = {
  /** What the group is for, read by screen readers when focus enters it ("Playback", "Sound style"). */
  label: string
  /** `Button`s. For a single choice, give each `pressed` and let the caller keep the state. */
  children: ReactNode
  className?: string
}

/** Buttons joined into one control: small gaps, rounded outer ends, the chosen one fully round. It is a labelled group, not a menu. */
export function ButtonGroup({ label, children, className }: Props) {
  return (
    <div role="group" aria-label={label} className={['ui-button-group', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
