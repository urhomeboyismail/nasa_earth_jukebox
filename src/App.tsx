import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import VoiceAssistant from './VoiceAssistant'
import { loadCatalog, loadVisualization, type Visualization } from './data'
import AboutPage from './features/about'
import ComparePage from './features/compare'
import HomePage from './features/home'
import LearnPage from './features/learn'
import PlayerPage from './features/player'
import type { PageProps } from './features/types'
import { useVoiceAssistant, type AssistantAction } from './hooks/useVoiceAssistant'
import { pages, type Page } from './pages'
import { hashFor, parseHash } from './route'
import './App.css'

const pageComponents: Record<Page, ComponentType<PageProps>> = {
  home: HomePage,
  learn: LearnPage,
  listen: PlayerPage,
  compare: ComparePage,
  about: AboutPage,
}

/** Opens a page by changing the hash, which adds a history entry so back and forward work. */
function goTo(page: Page) {
  window.location.hash = hashFor(page)
}

function App() {
  const [page, setPage] = useState<Page>(() => parseHash(window.location.hash).page)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [visualization, setVisualization] = useState<Visualization | null>(null)
  const [loadError, setLoadError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const shownPage = useRef(page)

  // Follow the address bar: links, back and forward, and edits to the hash. An unknown hash becomes #home.
  useEffect(() => {
    function follow() {
      const route = parseHash(window.location.hash)
      if (!route.known) window.history.replaceState(null, '', hashFor('home'))
      setPage(route.page)
    }
    follow()
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
  }, [])

  // Load the first visualization in the catalog. Choosing between several comes later (F16).
  useEffect(() => {
    let cancelled = false
    loadCatalog()
      .then(catalog => {
        if (!catalog.length) throw new Error('No visualizations are listed in public/data/index.json.')
        return loadVisualization(catalog[0].id)
      })
      .then(loaded => { if (!cancelled) setVisualization(loaded) })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error)) })
    return () => { cancelled = true }
  }, [])

  // Move focus to the new page's heading so screen readers announce it, but not on first load.
  useEffect(() => {
    if (shownPage.current !== page) heading.current?.focus()
    shownPage.current = page
  }, [page])

  const handleAssistantAction = useCallback((action: AssistantAction) => {
    if (action.action === 'navigate') goTo(action.page)
  }, [])

  const assistant = useVoiceAssistant({ language: 'en', page, onAction: handleAssistantAction })

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
        {loadError && <p role="alert">The data could not be loaded. {loadError}</p>}
        <CurrentPage visualization={visualization} />
      </main>

      {assistantOpen && <VoiceAssistant assistant={assistant} onClose={closeAssistant} />}
    </>
  )
}

export default App
