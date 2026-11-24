import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/testflow/',
  test: {
    environment: 'jsdom',
    setupFiles: ['test/support/setup.js'],
    // contexts.test.mjs roda no runner do Node (SSR); o Vitest cuida dos testes de DOM.
    include: ['test/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      reporter: ['text-summary', 'json-summary'],
      // Piso de cobertura de linhas: começa no valor medido e só sobe.
      thresholds: { lines: 2 },
    },
  },
})
