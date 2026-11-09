import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties, type MouseEvent } from 'react'
import VoiceAssistant from './VoiceAssistant'
import { AnnouncerProvider, DatasetPicker, Notice } from './components'
import { Icon, type IconName } from './components/Icon'
import { Sonny } from './components/Mascot'
import { loadCatalog, loadVisualization, type CatalogEntry, type Visualization } from './data'
import { DemoControl } from './features/demo/DemoControl'
import { HelpButton } from './features/help/HelpButton'
import HomePage from './features/home'
import type { PageProps } from './features/types'
import { noteGuidePlaybackCommand, useDucking } from './assistant/ducking'
import { sendPlayerCommand } from './features/player/controls'
import { useVoiceAssistant, type AssistantAction } from './hooks/useVoiceAssistant'
import { pages, type Page } from './pages'
import { currentDataParam, hashFor, parseHash } from './route'
import { useNavDrag } from './useNavDrag'
import './App.css'

// Home loads with the app; every other page is fetched the first time it is opened, so the first load stays small.
const AboutPage = lazy(() => import('./features/about'))
const ComparePage = lazy(() => import('./features/compare'))
const LearnPage = lazy(() => import('./features/learn'))
const PlayerPage = lazy(() => import('./features/player'))

const pageComponents: Record<Page, ComponentType<PageProps>> = {
  home: HomePage,
  learn: LearnPage,
  listen: PlayerPage,
  compare: ComparePage,
  about: AboutPage,
}

/** Navigation icons: the filled style marks the current page, so it never depends on color alone. */
const pageIcons: Record<Page, { current: IconName; other: IconName }> = {
  home: { current: 'home', other: 'home-outline' },
  learn: { current: 'school', other: 'school-outline' },
  listen: { current: 'headphones', other: 'headphones-outline' },
  compare: { current: 'difference', other: 'difference-outline' },
  about: { current: 'info', other: 'info-outline' },
}

/** Pages built around a tool (player, comparison) get the wider column; the rest are text, kept to a readable width. */
const wideTools = new Set<Page>(['listen', 'compare'])

/** Opens a page by changing the hash, which adds a history entry so back and forward work. Used by the voice guide. A chosen data set stays chosen. */
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
  const guideToggle = useRef<HTMLButtonElement>(null)
  const guideWasOpen = useRef(false)

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
  // Links carry the chosen data set so it survives a click; a missing one is swapped for the one showing, and none stays none.
  const linkData = dataMissing ? dataId : requestedData

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

  // A new page opens at its top, with focus on its heading so screen readers announce it (but not on first load).
  useEffect(() => {
    if (shownPage.current !== page) {
      window.scrollTo({ top: 0 })
      heading.current?.focus({ preventScroll: true })
    }
    shownPage.current = page
  }, [page])

  // The browser tab and history name the page too.
  useEffect(() => {
    document.title = `${pages.find(item => item.id === page)?.title} · Earth Jukebox`
  }, [page])

  // When the voice guide closes, put focus back on the button that opened it.
  useEffect(() => {
    if (guideWasOpen.current && !assistantOpen) guideToggle.current?.focus()
    guideWasOpen.current = assistantOpen
  }, [assistantOpen])

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

  /** Tapping the tab (or the wordmark) of the page you are on goes back to its top, as phone apps do. */
  function backToTop(event: MouseEvent, target: Page) {
    if (target !== page) return
    event.preventDefault()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    heading.current?.focus({ preventScroll: true })
  }

  const title = pages.find(item => item.id === page)?.title
  const CurrentPage = pageComponents[page]
  const pageIndex = pages.findIndex(item => item.id === page)
  const navDrag = useNavDrag(pages.length, index => { window.location.hash = hashFor(pages[index].id, { data: linkData }) })
  const shownIndex = navDrag.preview ?? pageIndex

  return (
    <AnnouncerProvider>
      {/* The hash holds the page, so the skip link moves focus itself instead of jumping to an anchor. */}
      <a className="app-skip" href={hashFor(page, { data: linkData })} onClick={event => { event.preventDefault(); heading.current?.focus() }}>
        Skip to content
      </a>
      <header className="app-header">
        <a className="app-brand" href={hashFor('home', { data: linkData })} onClick={event => backToTop(event, 'home')}>
          <svg className="app-brand__mark" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
            <circle cx="20" cy="20" r="20" />
            <path d="M11 23v-6h2.5v6zm5 5V12h2.5v16zm5-3V15h2.5v10zm5-3v-4h2.5v4z" />
          </svg>
          <span className="app-brand__name">Earth Jukebox</span>
        </a>
        <nav aria-label="Main" className={navDrag.dragging ? 'is-dragging' : undefined}
          style={{ '--nav-index': pageIndex, '--nav-count': pages.length } as CSSProperties} {...navDrag.handlers}>
          {/* The phone bar's glass highlight, which slides to the current tab (and follows the thumb while dragging). */}
          <span className="app-nav__glass" aria-hidden="true" />
          <ul className="app-nav">
            {pages.map((item, index) => {
              const current = item.id === page
              return (
                <li key={item.id}>
                  {/* The label is the full title; the mobile bar shows the short title, which is its first word(s). */}
                  <a className={`app-nav__item${index === shownIndex ? ' is-shown' : ''}`} href={hashFor(item.id, { data: linkData })}
                    aria-label={item.title} aria-current={current ? 'page' : undefined} draggable={false}
                    onClick={event => backToTop(event, item.id)}>
                    <span className="app-nav__indicator">
                      <Icon name={pageIcons[item.id][current ? 'current' : 'other']} />
                    </span>
                    <span className="app-nav__label app-nav__label--full">{item.title}</span>
                    <span className="app-nav__label app-nav__label--short">{item.shortTitle}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
        <button ref={guideToggle} type="button" className="app-guide-toggle" aria-pressed={assistantOpen}
          onClick={() => (assistantOpen ? closeAssistant() : setAssistantOpen(true))}>
          <Sonny size={32} className="app-guide-toggle__mascot" />
          <span className="app-guide-toggle__label">Voice guide</span>
          {/* Shown instead of the full label in a narrow header. Hidden from screen readers, so the button's name is always
              "Voice guide", which contains the visible word (WCAG 2.5.3). */}
          <span className="app-guide-toggle__short" aria-hidden="true">Guide</span>
        </button>
      </header>

      <main className={`app-main app-main--${wideTools.has(page) ? 'wide' : 'prose'}`}>
        <h1 ref={heading} tabIndex={-1}>{title}</h1>
        {/* The same place on every page (WCAG 3.2.6); a new page closes the panel. */}
        <HelpButton key={page} page={page} />
        <DemoControl />
        {catalog && catalog.length > 1 && dataId && !testMode && (
          <DatasetPicker catalog={catalog} value={dataId} onChange={id => { window.location.hash = hashFor(page, { data: id }) }} />
        )}
        {dataMissing && <Notice>The data set “{requestedData}” was not found, so this shows “{catalog?.[0].title}” instead.</Notice>}
        {loadError && <Notice variant="error">The data could not be loaded. {loadError}</Notice>}
        <Suspense fallback={<p role="status" className="app-loading">Loading…</p>}>
          <CurrentPage visualization={visualization} />
        </Suspense>
      </main>

      {assistantOpen && <VoiceAssistant assistant={assistant} onClose={closeAssistant} />}
    </AnnouncerProvider>
  )
}

export default App
