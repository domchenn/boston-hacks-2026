/**
 * Vite build/dev-server config for apps/web: React plugin, Tailwind plugin, the '@/'
 * import alias that points at src/, and envDir pointing at the repo root so the
 * single local .env keeps working after the workspace move (Vercel sets env itself).
 */

import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
