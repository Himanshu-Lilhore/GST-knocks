import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/GST-knocks/",
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined, // Ensure single-page behavior
      },
    },
  },
  server: {
    historyApiFallback: true, // Ensure local dev server handles SPA routing
  },
})
