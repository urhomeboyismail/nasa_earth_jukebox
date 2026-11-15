import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties, type MouseEvent } from 'react'
import { AnnouncerProvider, DatasetPicker, LoadingIndicator, Notice, ServerPill, ThemeSwitch } from './components'
import { Icon, type IconName } from './components/Icon'
import { DiscSelector } from './components/jukebox/DiscSelector'
import { RobotBadge } from './components/RobotBadge'
import { DataError, friendlyDataMessage, loadCatalog, loadVisualization, type CatalogEntry, type Visualization } from './data'
import { DisplayButton, DisplaySettingsProvider } from './display/DisplaySettings'
import { DemoControl } from './features/demo/DemoControl'
import { HelpButton } from './features/help/HelpButton'
import HomePage from './features/home'
import type { PageProps } from './features/types'
import { noteGuidePlaybackCommand, useDucking } from './assistant/ducking'
import { sendPlayerCommand } from './features/player/controls'
import { dispatch } from './interaction/registry'
import { loadAssistantAudio, useVoiceAssistant, type AssistantAction } from './hooks/useVoiceAssistant'
import { useWakeWord } from './hooks/useWakeWord'
import { useWakeSetting } from './assistant/wakeWord'
import { WakeIndicator } from './WakeIndicator'
import { MascotGuideProvider } from './features/mascot/MascotGuideProvider'
import { pages, type Page } from './pages'
import { currentDataParam, hashFor, isLandingHash, LANDING_HASH, parseHash } from './route'
import { useNavDrag } from './useNavDrag'
import { readLandingDone } from './features/landing/storage'
import './App.css'

// Home loads with the app; every other page is fetched the first time it is opened, so the first load stays small.
const AboutPage = lazy(() => import('./features/about'))
const LearnPage = lazy(() => import('./features/learn'))
const PlayerPage = lazy(() => import('./features/player'))
// Echo's corner widget is not needed to read the page, so it loads after it.
const MascotDock = lazy(() => import('./features/mascot/MascotDock'))
// The landing page (a first visit, or "Replay welcome") brings three.js, so it loads only then.
const Landing = lazy(() => import('./features/landing/Landing'))
// The voice panel loads the first time the guide is opened. The guide's audio code starts loading with it, so it is
// there by the time Start is pressed. If it fails here, Start loads it again and says so.
const VoiceAssistant = lazy(() => {
  loadAssistantAudio().catch(() => {})
  return import('./VoiceAssistant')
})

const pageComponents: Record<Page, ComponentType<PageProps>> = {
  home: HomePage,
  learn: LearnPage,
  listen: PlayerPage,
  about: AboutPage,
}

/** Navigation icons: the filled style marks the current page, so it never depends on color alone. */
const pageIcons: Record<Page, { current: IconName; other: IconName }> = {
  home: { current: 'home', other: 'home-outline' },
  learn: { current: 'school', other: 'school-outline' },
  listen: { current: 'headphones', other: 'headphones-outline' },
  about: { current: 'info', other: 'info-outline' },
}

/** Pages built around a tool (the player) get the wider column; the rest are text, kept to a readable width. */
const wideTools = new Set<Page>(['listen'])

/** Opens a page by changing the hash, which adds a history entry so back and forward work. Used by the voice guide. A chosen data set stays chosen. */
function goTo(page: Page) {
  window.location.hash = hashFor(page, { data: currentDataParam() })
}

/** The landing shows for #welcome, and for an empty address until it has been done once (a returning visitor goes straight to Home). */
const wantsLanding = (hash: string) => isLandingHash(hash) || (hash.replace(/^#/, '') === '' && !readLandingDone())

/** A load failure: the detail (file, status, validation) goes to the console, and the listener reads a plain sentence. */
function failureOf(id: string | null, error: unknown) {
  console.error(error)
  return { id, message: friendlyDataMessage(error) }
}

function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  const page = route.page
  /** The landing view: asked for by #welcome, or the first thing a new visitor sees. It replaces the whole app shell. */
  const [landing, setLanding] = useState(() => wantsLanding(window.location.hash))
  const wasLanding = useRef(landing)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null)
  const [loaded, setLoaded] = useState<Visualization | null>(null)
  /** `id` is the data set that failed, or null when the list itself could not be read. */
  const [failure, setFailure] = useState<{ id: string | null; message: string } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const shownPage = useRef(page)
  const guideToggle = useRef<HTMLButtonElement>(null)
  const guideWasOpen = useRef(false)
  /** Set when the voice guide changes the page, so the listener keeps their place instead of being moved to the heading. */
  const guideNavigated = useRef(false)

  // Follow the address bar: links, back and forward, and edits to the hash. An unknown hash becomes #home.
  useEffect(() => {
    function follow() {
      const { hash } = window.location
      const onLanding = wantsLanding(hash)
      if (onLanding && !isLandingHash(hash)) window.history.replaceState(null, '', LANDING_HASH)
      setLanding(onLanding)
      const route = parseHash(hash)
      if (!route.known && !onLanding) window.history.replaceState(null, '', hashFor('home'))
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
        if (!list.length) throw new DataError('index.json', 'lists no visualizations.')
        if (!cancelled) setCatalog(list)
      })
      .catch((error: unknown) => { if (!cancelled) setFailure(failureOf(null, error)) })
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
  // Links carry the chosen data set so it survives a click; a missing one is swapped for the one showing, and none stays none.
  const linkData = dataMissing ? dataId : requestedData
  // Listen chooses its data set from a crate of records; the other pages keep the plain list.
  const DataPicker = page === 'listen' ? DiscSelector : DatasetPicker

  useEffect(() => {
    if (!dataId) return
    let cancelled = false
    loadVisualization(dataId)
      .then(next => { if (!cancelled) setLoaded(next) })
      .catch((error: unknown) => { if (!cancelled) setFailure(failureOf(dataId, error)) })
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
      // The guide's own navigation is announced by its panel, so focus stays where it was.
      if (!guideNavigated.current) heading.current?.focus({ preventScroll: true })
      guideNavigated.current = false
    }
    shownPage.current = page
  }, [page])

  // Leaving the landing for Home opens it like any new page: at the top, with focus on its heading.
  useEffect(() => {
    if (wasLanding.current && !landing) {
      window.scrollTo({ top: 0 })
      heading.current?.focus({ preventScroll: true })
    }
    wasLanding.current = landing
  }, [landing])

  // The browser tab and history name the page too.
  useEffect(() => {
    document.title = `${landing ? 'Welcome' : pages.find(item => item.id === page)?.title} · Earth Jukebox`
  }, [page, landing])

  // When the voice guide closes, put focus back on the button that opened it.
  useEffect(() => {
    if (guideWasOpen.current && !assistantOpen) guideToggle.current?.focus()
    guideWasOpen.current = assistantOpen
  }, [assistantOpen])

  const handleAssistantAction = useCallback((action: AssistantAction) => {
    if (action.action === 'navigate') {
      // Only when the page will change; otherwise no page effect would clear the flag.
      guideNavigated.current = action.page !== parseHash(window.location.hash).page
      goTo(action.page)
    } else if (action.action === 'point') {
      // IX09: the same action as the E key, through the same dispatcher. With no sound map open, nothing handles it.
      dispatch({ type: 'point', target: action.target })
    } else {
      noteGuidePlaybackCommand(action.command)
      sendPlayerCommand(action.command)
    }
  }, [])

  const assistant = useVoiceAssistant({ language: 'en', page, onAction: handleAssistantAction })
  useDucking(assistant.status)
  /** What the guide is saying now, for Echo's robot to mouth (JB08). */
  const spokenLine = assistant.status === 'speaking' ? (assistant.transcript.findLast(entry => entry.role === 'assistant')?.text ?? '') : ''

  // "Hey Echo" (opt-in): opens the guide and starts talking, like "Hey Google". Words said after the phrase are asked once connected.
  const [wakeOn, setWakeOn] = useWakeSetting()
  const wakeQuestion = useRef<string | null>(null)
  const guideBusy = assistant.status === 'connecting' || assistant.status === 'listening' || assistant.status === 'speaking'
  const wake = useWakeWord({
    enabled: wakeOn,
    paused: guideBusy,
    lang: 'en',
    onWake: question => {
      wakeQuestion.current = question || null
      setAssistantOpen(true)
      assistant.start()
    },
  })
  const { sendText } = assistant
  useEffect(() => {
    if (assistant.status !== 'listening' || !wakeQuestion.current) return
    const question = wakeQuestion.current
    wakeQuestion.current = null
    sendText(question)
  }, [assistant.status, sendText])

  function closeAssistant() {
    wakeQuestion.current = null
    assistant.stop()
    setAssistantOpen(false)
  }

  // Alt+E opens and closes the voice guide, except while typing in a field.
  const toggleGuide = () => (assistantOpen ? closeAssistant() : setAssistantOpen(true))
  const toggleGuideRef = useRef(toggleGuide)
  useEffect(() => { toggleGuideRef.current = toggleGuide })
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.code !== 'KeyE') return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      event.preventDefault()
      toggleGuideRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  // The landing stands alone: no navigation, no data cards, no dock (its own robot is the hero).
  if (landing) {
    return (
      <AnnouncerProvider>
        <Suspense fallback={<div className="app-loading"><LoadingIndicator label="Loading…" /></div>}>
          <Landing onDone={() => { window.location.hash = hashFor('home', { data: linkData }) }} />
        </Suspense>
      </AnnouncerProvider>
    )
  }

  return (
    <AnnouncerProvider>
      <DisplaySettingsProvider>
      <MascotGuideProvider>
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
          <DisplayButton />
          <ThemeSwitch />
          <ServerPill />
          <button ref={guideToggle} type="button" className="app-guide-toggle" aria-pressed={assistantOpen}
            aria-keyshortcuts="Alt+E" onClick={toggleGuide}>
            <RobotBadge size={32} className="app-guide-toggle__mascot" />
            <span className="app-guide-toggle__label">Voice guide</span>
            {/* Shown instead of the full label in a narrow header. Hidden from screen readers, so the button's name is always
                "Voice guide", which contains the visible word (WCAG 2.5.3). */}
            <span className="app-guide-toggle__short" aria-hidden="true">Guide</span>
          </button>
          <WakeIndicator state={wake.state} onTurnOff={() => setWakeOn(false)} />
        </header>

        <main className={`app-main app-main--${wideTools.has(page) ? 'wide' : 'prose'}`}>
          <h1 ref={heading} tabIndex={-1}>{title}</h1>
          {/* The same place on every page (WCAG 3.2.6); a new page closes the panel. */}
          {/* Help and the demo share a row where they fit (LY01), so the page itself starts higher on a phone. */}
          <div className="app-tools">
            <HelpButton key={page} page={page} />
            <DemoControl />
          </div>
          {catalog && catalog.length > 1 && dataId && (
            <DataPicker catalog={catalog} value={dataId} onChange={id => { window.location.hash = hashFor(page, { data: id }) }} />
          )}
          {dataMissing && <Notice>The data set “{requestedData}” was not found, so this shows “{catalog?.[0].title}” instead.</Notice>}
          {loadError && <Notice variant="error">{loadError}</Notice>}
          <Suspense fallback={<div className="app-loading"><LoadingIndicator label="Loading…" /></div>}>
            <CurrentPage visualization={visualization} />
          </Suspense>
        </main>

        {assistantOpen && (
          <Suspense fallback={<div className="app-loading"><LoadingIndicator label="Loading the voice guide…" /></div>}>
            <VoiceAssistant assistant={assistant} onClose={closeAssistant} />
          </Suspense>
        )}

        {/* Echo, bottom right on every page. Not keyed by page: its 3D robot is set up once (the dock closes its bubble on a new page). */}
        <Suspense fallback={null}>
          <MascotDock page={page} loading={!visualization && !loadError} voice={assistant.status} voiceOpen={assistantOpen} line={spokenLine}
            onTalk={() => setAssistantOpen(true)} />
        </Suspense>
      </MascotGuideProvider>
      </DisplaySettingsProvider>
    </AnnouncerProvider>
  )
}

export default App
