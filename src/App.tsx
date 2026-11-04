import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import VoiceAssistant from './VoiceAssistant'
import { DatasetPicker, Notice } from './components'
import { loadCatalog, loadVisualization, type CatalogEntry, type Visualization } from './data'
import AboutPage from './features/about'
import ComparePage from './features/compare'
import HomePage from './features/home'
import LearnPage from './features/learn'
import PlayerPage from './features/player'
import type { PageProps } from './features/types'
import { noteGuidePlaybackCommand, useDucking } from './assistant/ducking'
import { sendPlayerCommand } from './features/player/controls'
import { useVoiceAssistant, type AssistantAction } from './hooks/useVoiceAssistant'
import { pages, type Page } from './pages'
import { currentDataParam, hashFor, parseHash } from './route'
import './App.css'

const pageComponents: Record<Page, ComponentType<PageProps>> = {
  home: HomePage,
  learn: LearnPage,
  listen: PlayerPage,
  compare: ComparePage,
  about: AboutPage,
}

/** Opens a page by changing the hash, which adds a history entry so back and forward work. A chosen data set stays chosen. */
function goTo(page: Page) {
  window.location.hash = hashFor(page, { data: currentDataParam() })
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  const page = route.page
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [loaded, setLoaded] = useState<Visualization | null>(null)
  /** `id` is the data set that failed, or null when the list itself could not be read. */
  const [failure, setFailure] = useState<{ id: string | null; message: string } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const shownPage = useRef(page)

  // Follow the address bar: links, back and forward, and edits to the hash. An unknown hash becomes #home.
  useEffect(() => {
    function follow() {
      const route = parseHash(window.location.hash)
      if (!route.known) window.history.replaceState(null, '', hashFor('home'))
      setRoute(route)
    }
    follow()
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])

  // The list of data sets.
  useEffect(() => {
    let cancelled = false
    loadCatalog()
      .then(list => {
        if (!list.length) throw new Error('No visualizations are listed in public/data/index.json.')
        if (!cancelled) setCatalog(list)
      })
      .catch((error: unknown) => { if (!cancelled) setFailure({ id: null, message: messageOf(error) }) })
    return () => { cancelled = true }
  }, [])

  // The data set to show: the one named in the address, or the first in the list.
  const requestedData = route.params.get('data')
  const chosen = catalog?.find(entry => entry.id === requestedData)
  const dataId = catalog?.length ? (chosen?.id ?? catalog[0].id) : null
  const dataMissing = !!catalog?.length && !!requestedData && !chosen
  // A pages' data is only handed over once it is the chosen one, so the old set never shows under the new choice.
  const visualization = loaded && loaded.id === dataId ? loaded : null
  const loadError = failure && (failure.id === null || failure.id === dataId) ? failure.message : ''
  const testMode = page === 'compare' && route.params.get('test') === '1'

  useEffect(() => {
    if (!dataId) return
    let cancelled = false
    loadVisualization(dataId)
      .then(next => { if (!cancelled) setLoaded(next) })
      .catch((error: unknown) => { if (!cancelled) setFailure({ id: dataId, message: messageOf(error) }) })
    return () => { cancelled = true }
  }, [dataId])

  // An address that names a data set that is not there is tidied to the one that is showing.
  useEffect(() => {
    if (dataMissing && dataId) window.history.replaceState(null, '', hashFor(page, { data: dataId }))
  }, [dataMissing, dataId, page])

  // Move focus to the new page's heading so screen readers announce it, but not on first load.
  useEffect(() => {
    if (shownPage.current !== page) heading.current?.focus()
    shownPage.current = page
  }, [page])

  const handleAssistantAction = useCallback((action: AssistantAction) => {
    if (action.action === 'navigate') goTo(action.page)
    else {
      noteGuidePlaybackCommand(action.command)
      sendPlayerCommand(action.command)
    }
  }, [])

  const assistant = useVoiceAssistant({ language: 'en', page, onAction: handleAssistantAction })
  useDucking(assistant.status)

  function closeAssistant() {
    assistant.stop()
    setAssistantOpen(false)
  }

  const title = pages.find(item => item.id === page)?.title
  const CurrentPage = pageComponents[page]

  return (
    <>
      <header className="app-header">
        <p className="app-name">Earth Jukebox</p>
        <nav aria-label="Main">
          <ul className="app-nav">
            {pages.map(item => (
              <li key={item.id}>
                <button type="button" aria-current={item.id === page ? 'page' : undefined} onClick={() => goTo(item.id)}>
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="app-guide-toggle" aria-pressed={assistantOpen}
          onClick={() => (assistantOpen ? closeAssistant() : setAssistantOpen(true))}>
          Voice guide
        </button>
      </header>

      <main className="app-main">
        <h1 ref={heading} tabIndex={-1}>{title}</h1>
        {catalog && catalog.length > 1 && dataId && !testMode && (
          <DatasetPicker catalog={catalog} value={dataId} onChange={id => { window.location.hash = hashFor(page, { data: id }) }} />
        )}
        {dataMissing && <Notice>The data set “{requestedData}” was not found, so this shows “{catalog?.[0].title}” instead.</Notice>}
        {loadError && <p role="alert">The data could not be loaded. {loadError}</p>}
        <CurrentPage visualization={visualization} />
      </main>

      {assistantOpen && <VoiceAssistant assistant={assistant} onClose={closeAssistant} />}
    </>
  )
}

export default App
