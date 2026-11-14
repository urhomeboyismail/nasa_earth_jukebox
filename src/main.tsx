import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyStoredTheme } from './hooks/useTheme'
import { SkyBackdrop } from './motion/SkyBackdrop'

applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SkyBackdrop />
    <App />
  </StrictMode>,
)

// Saved data sets play without a network (src/data/offline.ts). Only in a build: the dev server's files change all the time.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    // Saving for offline still downloads; the files just are not served without a network.
  })
}

