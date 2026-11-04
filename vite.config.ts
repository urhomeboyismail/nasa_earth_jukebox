import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The voice guide server (server/), including its WebSocket.
    proxy: { '/api': { target: 'http://127.0.0.1:8000', ws: true } },
  },
})
