import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  build: {
    outDir: '../../backend/app/static/admin',
    emptyOutDir: true,
    assetsDir: 'assets'
  }
})
