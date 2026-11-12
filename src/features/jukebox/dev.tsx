// A page for hearing a payload while the player is not on a page of the app (G09). Only the dev server serves it, at
// /jukebox.html: the production build starts from index.html and never reaches this file.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { AnnouncerProvider } from '../../components'
import { DevPage } from './DevPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnnouncerProvider>
      <DevPage />
    </AnnouncerProvider>
  </StrictMode>,
)
