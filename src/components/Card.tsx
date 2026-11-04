import type { ReactNode } from 'react'

type Props = {
  title: string
  /** Which heading level fits the page outline. The page title is h1, so cards usually use 2. */
  headingLevel?: 2 | 3 | 4
  children: ReactNode
}

export function Card({ title, headingLevel = 2, children }: Props) {
  const Heading = `h${headingLevel}` as const
  return (
    <section className="ui-card">
      <Heading className="ui-card__title">{title}</Heading>
      <div className="ui-card__body">{children}</div>
    </section>
  )
}
