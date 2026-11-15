import { Card } from '../../components'
import { useDisplaySettings } from '../../display/useDisplaySettings'
import { higherPhrase, variableWords } from '../../data'
import { pages, type Page } from '../../pages'
import { currentDataParam, hashFor } from '../../route'
import type { PageProps } from '../types'
import { ComingNext } from './ComingNext'
import { Crate } from './Crate'
import './home.css'

/** The order a new listener should take the pages in, and what each one is for. */
const STEPS: { page: Page; text: string }[] = [
  { page: 'learn', text: 'Hear what each sound means before you start.' },
  { page: 'listen', text: 'Play the dates one after another and follow the change by ear.' },
]

const titleOf = (page: Page) => pages.find(item => item.id === page)?.title ?? page

export default function HomePage({ visualization }: PageProps) {
  const data = currentDataParam()
  const { flags } = useDisplaySettings()
  return (
    <div className="home">
      <p>Hear how our planet is changing. The Earth Jukebox turns NASA Earth imagery into sound.</p>
      {visualization && <p>Now playing from: {visualization.title}. {visualization.summary}</p>}

      {!flags.hideCrate && <Crate currentId={visualization?.id ?? null} />}
      {!flags.hideCrate && <ComingNext />}

      <Card title="What you will try" headingLevel={2}>
        <p>Can you hear, without seeing the image, which date shows {higherPhrase(variableWords(visualization?.variable))}, and when the change happened?</p>
      </Card>

      <Card title="Start here" headingLevel={2}>
        <ol className="home__steps" aria-label="Steps">
          {STEPS.map(({ page, text }) => (
            <li key={page}>
              <a href={hashFor(page, { data })}>{titleOf(page)}</a>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </Card>

      <p className="home__note">
        {visualization && <>Imagery: {visualization.source.credit}. </>}
        The values you hear are approximate: they come from the colours of a published image. The About page gives the source, the method and its limits.
      </p>
      <a className="home__about" href={hashFor('about', { data })}>About the data</a>
    </div>
  )
}
