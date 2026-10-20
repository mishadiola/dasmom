import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: mode === 'android'
      ? { './App.jsx': fileURLToPath(new URL('./src/App.android.jsx', import.meta.url)) }
      : {}
  }
}))
