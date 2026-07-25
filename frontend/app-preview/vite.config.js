import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/app-preview/',
  build: {
    outDir: '../../backend/app/static/app-preview',
    emptyOutDir: true,
    assetsDir: 'assets'
  }
})
