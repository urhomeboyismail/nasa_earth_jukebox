import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Vite does not reload for files in public/, so a manifest edit while tuning a data set (EIC04) reloads the page here.
const reloadOnData: Plugin = {
  name: 'reload-on-data',
  apply: 'serve',
  configureServer(server) {
    server.watcher.on('change', file => {
      if (/[\\/]public[\\/]data[\\/].+\.json$/.test(file)) server.ws.send({ type: 'full-reload' })
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), reloadOnData],
  server: {
    // The voice guide server (server/), including its WebSocket.
    proxy: { '/api': { target: 'http://127.0.0.1:8000', ws: true } },
  },
})
