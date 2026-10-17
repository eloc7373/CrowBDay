import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so the static build works from any folder, fully offline.
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
