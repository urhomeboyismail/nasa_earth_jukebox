import { useEffect, useId, useState } from 'react'
import { Button, Card, Notice, useAnnounce } from '../../components'
import { loadCatalog, type CatalogEntry } from '../../data'
import { canSaveOffline, removeOffline, saveOffline, savedIds } from '../../data/offline'
import { hashFor } from '../../route'
import { readRecent, rememberRecent } from './recent'

type Saving = { id: string; share: number }

/**
 * The crate (docs/planning/UIUX-BLUEPRINT.md §2.1, §3.1): every data set in index.json, searchable, with the ones opened lately first and a way
 * to save one on this device. Opening a data set goes to Listen with it.
 */
export function Crate({ currentId }: { currentId: string | null }) {
  const announce = useAnnounce()
  const id = useId()
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [onlySaved, setOnlySaved] = useState(false)
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set())
  const [saving, setSaving] = useState<Saving | null>(null)
  const [problem, setProblem] = useState('')
  const [recent] = useState(readRecent)
  const offline = canSaveOffline()

  useEffect(() => {
    let cancelled = false
    loadCatalog().then(entries => { if (!cancelled) setCatalog(entries) }, () => { if (!cancelled) setFailed(true) })
    savedIds().then(ids => { if (!cancelled) setSaved(ids) }, () => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => { if (currentId) rememberRecent(currentId) }, [currentId])

  if (failed) return null
  if (!catalog) return <p role="status">Loading the data sets…</p>

  const words = query.trim().toLowerCase()
  const shown = catalog.filter(entry => (!onlySaved || saved.has(entry.id)) && (!words || `${entry.title} ${entry.summary}`.toLowerCase().includes(words)))
  const recentEntries = recent.map(r => catalog.find(entry => entry.id === r)).filter((entry): entry is CatalogEntry => !!entry)

  async function save(entry: CatalogEntry) {
    setProblem('')
    setSaving({ id: entry.id, share: 0 })
    announce(`Saving ${entry.title}.`)
    try {
      await saveOffline(entry.id, share => setSaving({ id: entry.id, share }))
      setSaved(current => new Set([...current, entry.id]))
      announce(`${entry.title} is saved on this device.`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      setProblem(`${entry.title} could not be saved. ${reason}`)
    } finally {
      setSaving(null)
    }
  }

  async function remove(entry: CatalogEntry) {
    await removeOffline(entry.id)
    setSaved(current => new Set([...current].filter(other => other !== entry.id)))
    announce(`${entry.title} was removed from this device.`)
  }

  return (
    <Card title="The crate" headingLevel={2}>
      {recentEntries.length > 0 && (
        <nav aria-label="Continue where you left off" className="crate__recent">
          <span>Continue:</span>
          {recentEntries.map(entry => <a key={entry.id} href={hashFor('listen', { data: entry.id })}>{entry.title}</a>)}
        </nav>
      )}
      <div className="crate__filters">
        <label htmlFor={`${id}-search`}>Search data sets</label>
        <input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.currentTarget.value)} aria-describedby={`${id}-count`} />
        {offline && (
          <label className="crate__only-saved">
            <input type="checkbox" checked={onlySaved} onChange={event => setOnlySaved(event.currentTarget.checked)} />
            Saved on this device only
          </label>
        )}
      </div>
      <p id={`${id}-count`} role="status" className="crate__count">{shown.length === 1 ? '1 data set' : `${shown.length} data sets`}</p>
      {problem && <Notice>{problem}</Notice>}
      <ul className="crate__list" aria-label="Data sets">
        {shown.map(entry => (
          <li key={entry.id} className="crate__sleeve">
            <h3 className="crate__title">{entry.title}</h3>
            <p>{entry.summary}</p>
            {saved.has(entry.id) && <p className="crate__badge">Saved on this device</p>}
            {saving?.id === entry.id && <progress value={saving.share} aria-label={`Saving ${entry.title}`} />}
            <div className="crate__buttons">
              <a className="crate__open" href={hashFor('listen', { data: entry.id })} aria-label={`Open ${entry.title}`}>Open</a>
              {offline && (saved.has(entry.id)
                ? <Button onClick={() => void remove(entry)}>{`Remove ${entry.title} from this device`}</Button>
                : <Button disabled={saving !== null} onClick={() => void save(entry)}>{`Save ${entry.title} for offline`}</Button>)}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
