import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Button, Card, Notice, useAnnounce } from '../../components'
import { loadCatalog, type CatalogEntry, type ColorScale, type Visualization } from '../../data'
import { canSaveOffline, removeOffline, saveOffline, savedIds } from '../../data/offline'
import { hashFor } from '../../route'
import { mascotTheme } from '../mascot/accent'
import { createPreview, loadManifest, PREVIEW_SECONDS, type Preview } from './preview'
import { readRecent, rememberRecent } from './recent'

type Saving = { id: string; share: number }
/** The record being previewed: preparing until its first frame sounds, then playing. */
type Active = { id: string; phase: 'preparing' | 'playing' }
type RecordStyle = CSSProperties & Record<`--${string}`, string>

/** The colour scale as the disc's label: a conic gradient through its stops, low values first. Undefined when it has none to draw. */
function discOf(colorScale: ColorScale): string | undefined {
  const stops = [...colorScale.stops].sort((a, b) => a.value - b.value)
  if (!stops.length) return undefined
  const [low, high] = [stops[0].value, stops[stops.length - 1].value]
  const colours = stops.map(({ value, rgb }, index) => {
    const share = high === low ? index / Math.max(1, stops.length - 1) : (value - low) / (high - low)
    return `rgb(${rgb.join(' ')}) ${Math.round(share * 100)}%`
  })
  return `conic-gradient(${colours.join(', ')})`
}

/** What a record's disc is painted with, from its manifest. Nothing before the manifest has loaded: the disc is then plain. */
function recordStyle(visualization: Visualization | undefined): RecordStyle | undefined {
  if (!visualization) return undefined
  const disc = discOf(visualization.colorScale)
  return { ...(disc && { '--disc': disc }), '--accent': mascotTheme(visualization).accent }
}

const datesIn = (visualization: Visualization) => (visualization.frames.length === 1 ? '1 date' : `${visualization.frames.length} dates`)

/**
 * The crate (docs/planning/UIUX-BLUEPRINT.md §2.1, §3.1): every data set in index.json as a record in a glass sleeve, searchable, with the ones opened
 * lately first, a way to save one on this device and a 10-second preview of its own sound. Opening a data set goes to Listen with it.
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
  const [manifests, setManifests] = useState<ReadonlyMap<string, Visualization>>(new Map())
  const [active, setActive] = useState<Active | null>(null)
  const [recent] = useState(readRecent)
  const offline = canSaveOffline()
  /** The preview in hand, and a count that changes whenever one is stopped, so a preview still being prepared knows it is no longer wanted. */
  const current = useRef<{ preview: Preview | null; run: number }>({ preview: null, run: 0 })

  useEffect(() => {
    let cancelled = false
    loadCatalog().then(entries => { if (!cancelled) setCatalog(entries) }, () => { if (!cancelled) setFailed(true) })
    savedIds().then(ids => { if (!cancelled) setSaved(ids) }, () => {})
    return () => { cancelled = true }
  }, [])

  // The records are painted from their manifests. One that cannot be read stays a plain disc.
  useEffect(() => {
    if (!catalog) return
    let cancelled = false
    for (const entry of catalog) {
      loadManifest(entry.id).then(
        visualization => { if (!cancelled) setManifests(known => new Map(known).set(entry.id, visualization)) },
        () => {},
      )
    }
    return () => { cancelled = true }
  }, [catalog])

  useEffect(() => { if (currentId) rememberRecent(currentId) }, [currentId])

  // Leaving Home ends the preview.
  useEffect(() => {
    const holder = current.current
    return () => {
      holder.run++
      holder.preview?.stop()
      holder.preview = null
    }
  }, [])

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

  /** Ends the preview, whether it is still being prepared or already sounding. */
  function stopPreview() {
    const holder = current.current
    holder.run++
    const preview = holder.preview
    holder.preview = null
    preview?.stop()
    setActive(null)
  }

  async function play(entry: CatalogEntry) {
    const holder = current.current
    if (active?.id === entry.id) {
      stopPreview()
      announce('Preview ended.')
      return
    }
    // One preview at a time: the one in hand ends as this one starts.
    stopPreview()
    const run = holder.run
    setProblem('')
    setActive({ id: entry.id, phase: 'preparing' })
    announce(`Preview of ${entry.title}, ${PREVIEW_SECONDS} seconds.`)
    let visualization: Visualization
    try {
      visualization = manifests.get(entry.id) ?? await loadManifest(entry.id)
    } catch (error) {
      if (run !== holder.run) return
      setActive(null)
      setProblem(`${entry.title} could not be previewed. ${error instanceof Error ? error.message : String(error)}`)
      return
    }
    if (run !== holder.run) return
    const preview: Preview = createPreview(visualization, {
      onPlaying() {
        if (holder.preview === preview) setActive({ id: entry.id, phase: 'playing' })
      },
      onEnd(error) {
        if (holder.preview !== preview) return
        holder.preview = null
        setActive(null)
        if (error) setProblem(`${entry.title} could not be previewed. ${error.message}`)
        else announce('Preview ended.')
      },
    })
    holder.preview = preview
    await preview.start()
  }

  return (
    <Card title="The crate" headingLevel={2}>
      {recentEntries.length > 0 && (
        <nav aria-label="Continue where you left off" className="crate__recent">
          <span>Continue:</span>
          {recentEntries.map(entry => <a key={entry.id} className="crate__pill crate__pill--link" href={hashFor('listen', { data: entry.id })}>{entry.title}</a>)}
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
        {shown.map(entry => {
          const visualization = manifests.get(entry.id)
          const mine = active?.id === entry.id ? active : null
          return (
            <li key={entry.id} className="crate__sleeve" style={recordStyle(visualization)}>
              {/* The disc is decoration: everything it shows is said in the text beside it. */}
              <span className="crate__disc" aria-hidden="true" />
              <div className="crate__body">
                <h3 className="crate__title">{entry.title}</h3>
                <p>{entry.summary}</p>
                {(saved.has(entry.id) || visualization) && (
                  <div className="crate__pills">
                    {saved.has(entry.id) && <span className="crate__pill crate__badge">Saved on this device</span>}
                    {visualization && <span className="crate__pill">{datesIn(visualization)}</span>}
                  </div>
                )}
                {saving?.id === entry.id && <progress value={saving.share} aria-label={`Saving ${entry.title}`} />}
                <div className="crate__buttons">
                  {/* The name of an idle button holds its visible words (WCAG 2.5.3) and adds the data set, because every record has one. */}
                  <Button variant="primary" onClick={() => void play(entry)} aria-label={mine ? undefined : `Play ${PREVIEW_SECONDS} seconds of ${entry.title}`}>
                    {mine ? (mine.phase === 'preparing' ? 'Preparing…' : 'Stop preview') : `Play ${PREVIEW_SECONDS} seconds`}
                  </Button>
                  <a className="crate__open" href={hashFor('listen', { data: entry.id })} aria-label={`Open in Listen: ${entry.title}`}>Open in Listen</a>
                  {/* Short visible words (LY02: the title made them wrap to three lines on a phone); the name adds the data set after them. */}
                  {offline && (saved.has(entry.id)
                    ? <Button onClick={() => void remove(entry)} aria-label={`Remove from this device: ${entry.title}`}>Remove from this device</Button>
                    : <Button disabled={saving !== null} onClick={() => void save(entry)} aria-label={`Save for offline: ${entry.title}`}>Save for offline</Button>)}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
