import type { ReactNode } from 'react'

type Props = {
  title: string
  /** Which heading level fits the page outline. The page title is h1, so cards usually use 2. */
  headingLevel?: 2 | 3 | 4
  /** Material 3 card styles: elevated (a raised tint, the default), filled (a stronger tint) or outlined (a border). */
  variant?: 'elevated' | 'filled' | 'outlined'
  children: ReactNode
}

export function Card({ title, headingLevel = 2, variant = 'elevated', children }: Props) {
  const Heading = `h${headingLevel}` as const
  return (
    <section className={`ui-card ui-card--${variant}`}>
      <Heading className="ui-card__title">{title}</Heading>
      <div className="ui-card__body">{children}</div>
    </section>
  )
}
