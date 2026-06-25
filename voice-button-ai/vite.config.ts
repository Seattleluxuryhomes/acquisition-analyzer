import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the same build works as a web app and inside a
// Chrome extension popup (where assets are loaded via chrome-extension://).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    // Forward the Fable Execution Engine to the local server during dev.
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
