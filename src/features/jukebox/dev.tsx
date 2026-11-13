// The Jukebox studio, for hearing an answer while the player is not on a page of the app (G09, G10). Only the dev server serves it, at
// /jukebox.html: the production build starts from index.html and never reaches this file.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { AnnouncerProvider } from '../../components'
import { JukeboxStudio } from './JukeboxStudio'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnnouncerProvider>
      <JukeboxStudio />
    </AnnouncerProvider>
  </StrictMode>,
)
