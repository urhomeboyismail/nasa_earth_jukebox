import type { ReactNode } from 'react'

type Props = {
  title: string
  /** Which heading level fits the page outline. The page title is h1, so cards usually use 2. */
  headingLevel?: 2 | 3 | 4
  /** `outlined` (the default) has an edge, `filled` a tinted surface, `elevated` a shadow. */
  variant?: 'filled' | 'elevated' | 'outlined'
  children: ReactNode
}

export function Card({ title, headingLevel = 2, variant = 'outlined', children }: Props) {
  const Heading = `h${headingLevel}` as const
  return (
    <section className={variant === 'outlined' ? 'ui-card' : `ui-card ui-card--${variant}`}>
      <Heading className="ui-card__title">{title}</Heading>
      <div className="ui-card__body">{children}</div>
    </section>
  )
}
