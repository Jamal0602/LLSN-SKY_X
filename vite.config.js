import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/horizons.api': {
        target: 'https://ssd.jpl.nasa.gov',
        changeOrigin: true,
        secure: true,
      },
      '/api/moon-dem': {
        target: 'https://trek.nasa.gov/moon/trekarcgis/rest/services',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/moon-dem/, ''),
      },
    },
  },
})
