import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // sockjs-client (pulled in by ws/useFloorSocket) references a bare `global`,
  // which doesn't exist in the browser and throws on load, blanking the app.
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
  },
})
