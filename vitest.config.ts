import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    pool: 'vmThreads',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Tests read index.css as text (src/styles/tokens.test.ts); Vitest otherwise replaces CSS with nothing.
    css: { include: /index\.css/ },
  },
})
