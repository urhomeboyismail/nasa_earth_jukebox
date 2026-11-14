import type { ReactNode } from 'react'
import { Button } from './Button'

type Props = {
  variant?: 'info' | 'warning' | 'error'
  children: ReactNode
  /** An optional button at the end, for example "Try again". */
  action?: { label: string; onClick: () => void; disabled?: boolean }
}

// Material Symbols (Apache 2.0).
const icons = {
  info: 'M11 17h2v-6h-2zm1.713-8.287Q13 8.425 13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9t.713-.288M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22',
  warning: 'M1 21L12 2l11 19zm11.713-3.287Q13 17.425 13 17t-.288-.712T12 16t-.712.288T11 17t.288.713T12 18t.713-.288M11 15h2v-5h-2z',
  error: 'M12.713 16.713Q13 16.425 13 16t-.288-.712T12 15t-.712.288T11 16t.288.713T12 17t.713-.288M11 13h2V7h-2zm1 9q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22',
}

const labels = { info: '', warning: 'Warning: ', error: 'Error: ' }

/**
 * A message in a colored container. Errors and warnings are announced at once (role alert) and start with the word
 * "Error" or "Warning", so color and icon are never the only cue. Information is a polite status.
 */
export function Notice({ variant = 'info', children, action }: Props) {
  return (
    <div className={`ui-notice ui-notice--${variant}${variant === 'info' ? ' ui-glass' : ''}`} role={variant === 'info' ? 'status' : 'alert'}>
      <svg className="ui-notice__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={icons[variant]} /></svg>
      <div className="ui-notice__text">
        {labels[variant] && <strong className="ui-notice__label">{labels[variant]}</strong>}
        {children}
      </div>
      {action && (
        <Button variant="outlined" className="ui-notice__action" disabled={action.disabled} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
