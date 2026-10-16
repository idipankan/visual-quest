import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The Express backend (npm run dev:server) holds the TypeSafe key; the browser never sees it.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
