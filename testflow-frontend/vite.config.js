import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/testflow/',
  test: {
    environment: 'jsdom',
    // Cada arquivo de teste monta páginas inteiras no jsdom e usa CPU o tempo todo. Com um worker por
    // núcleo, vários checks ao mesmo tempo disputam a CPU e testes de ~1 s passam de 5 s. Medido com a
    // máquina em carga ~15 e cobertura ligada: 7 workers passam de 5 s e falham, 2 ainda estouraram uma
    // vez, 1 mantém o maior teste em ~3 s.
    maxWorkers: 1,
    setupFiles: ['test/support/setup.js'],
    // contexts.test.mjs roda no runner do Node (SSR); o Vitest cuida dos testes de DOM.
    include: ['test/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      reporter: ['text-summary', 'json-summary'],
      // Piso de cobertura de linhas: começa no valor medido e só sobe.
      thresholds: { lines: 9 },
    },
  },
})
