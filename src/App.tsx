import { useCallback, useEffect, useRef, useState } from 'react'
import VoiceAssistant from './VoiceAssistant'
import { useVoiceAssistant, type AssistantAction } from './hooks/useVoiceAssistant'
import { pages, type Page } from './pages'
import './App.css'

const summaries: Record<Page, string> = {
  home: 'Hear how our planet is changing. The Earth Jukebox turns NASA Earth imagery into sound.',
  learn: 'Learn what each sound means before you listen to the data.',
  listen: 'Play a sequence of NASA imagery as sound, one date after another.',
  compare: 'Choose two dates, listen to each, and decide which shows the change.',
  about: 'Where the imagery comes from, and how its colours become sound.',
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  // Move focus to the new page's heading so screen readers announce it, but not on first load.
  useEffect(() => {
    if (moved.current) heading.current?.focus()
    moved.current = true
  }, [page])

  const handleAssistantAction = useCallback((action: AssistantAction) => {
    if (action.action === 'navigate') setPage(action.page)
  }, [])

  const assistant = useVoiceAssistant({ language: 'en', page, onAction: handleAssistantAction })

  function closeAssistant() {
    assistant.stop()
    setAssistantOpen(false)
  }

  const title = pages.find(item => item.id === page)?.title

  return (
    <>
      <header className="app-header">
        <p className="app-name">Earth Jukebox</p>
        <nav aria-label="Main">
          <ul className="app-nav">
            {pages.map(item => (
              <li key={item.id}>
                <button type="button" aria-current={item.id === page ? 'page' : undefined} onClick={() => setPage(item.id)}>
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
        <p>{summaries[page]}</p>
      </main>

      {assistantOpen && <VoiceAssistant assistant={assistant} onClose={closeAssistant} />}
    </>
  )
}

export default App
