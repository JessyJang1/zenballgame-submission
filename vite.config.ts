import { defineConfig } from 'vite'
import { openingProgramPlugin } from './tools/opening-program-plugin'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), openingProgramPlugin()],
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@dimforge/')) return 'rapier'
        },
      },
    },
  },
})
