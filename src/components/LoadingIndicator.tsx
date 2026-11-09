type Props = {
  /** What is happening, in words, for example "Analyzing the images…". */
  label?: string
  /** Hide the words on screen when something nearby already says them. Screen readers still hear them. */
  hideLabel?: boolean
}

/**
 * The Material 3 Expressive loading indicator: a morphing shape, with its meaning in text (role status, so screen
 * readers announce it politely). With reduced motion the shape stands still.
 */
export function LoadingIndicator({ label = 'Loading…', hideLabel = false }: Props) {
  return (
    <div className="ui-loading" role="status">
      <span className="ui-loading__container" aria-hidden="true"><span className="ui-loading__shape" /></span>
      <span className={hideLabel ? 'ui-visually-hidden' : 'ui-loading__label'}>{label}</span>
    </div>
  )
}
