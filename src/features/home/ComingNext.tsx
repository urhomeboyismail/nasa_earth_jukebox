import { useEffect, useState, type CSSProperties } from 'react'
import { Card } from '../../components'
import { loadQueue, type QueueEntry } from './comingNext'

const FAMILY_ACCENT = { ocean: 'var(--md-sys-color-primary)', atmosphere: 'var(--md-sys-color-tertiary)', forest: 'var(--md-sys-color-secondary)' } as const
const accentStyle = (entry: QueueEntry): CSSProperties & Record<'--accent', string> => ({ '--accent': FAMILY_ACCENT[entry.family] })

/** NASA SVS visualizations queued for sonification. They are listed only, with a link to NASA, and cannot be played yet. */
export function ComingNext() {
  const [entries, setEntries] = useState<QueueEntry[]>([])
  useEffect(() => {
    let live = true
    void loadQueue().then(list => live && setEntries(list))
    return () => { live = false }
  }, [])
  if (entries.length === 0) return null
  return (
    <Card title="Coming next from NASA SVS" headingLevel={2}>
      <p>More NASA Earth visualizations from the Scientific Visualization Studio, waiting their turn on the Jukebox.</p>
      <ul className="crate__list" aria-label="Queued data sets">
        {entries.map(entry => (
          <li key={entry.id} className="crate__sleeve" style={accentStyle(entry)}>
            <span className="crate__disc" aria-hidden="true" />
            <div className="crate__body">
              <h3 className="crate__title">{entry.title}</h3>
              <p>{entry.summary}</p>
              <p><em>How it could sound:</em> {entry.soundIdea}</p>
              <div className="crate__pills">
                <span className="crate__pill">Sonification in preparation</span>
                <span className="crate__pill">Released {entry.released}</span>
              </div>
              <a className="crate__open" href={entry.url} target="_blank" rel="noreferrer">View on NASA SVS: {entry.title}</a>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
