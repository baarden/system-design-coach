import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  envDir: resolve(__dirname, './'), // Load .env files from project root
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, './src/shared'),
    },
  },
  server: {
    host: true, // Listen on all addresses including LAN and public
    port: 5173,
    proxy: {
      // Only proxy API requests, not source files in the api/ folder
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Don't proxy requests for .ts/.tsx files (those are source modules)
        bypass: (req) => {
          if (req.url?.match(/\.(ts|tsx|js|jsx)$/)) {
            return req.url;
          }
        },
      },
      '/socket': {
        target: 'ws://localhost:3001',
        ws: true,
        rewriteWsOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: [
      '@excalidraw/excalidraw',
      '@excalidraw/mermaid-to-excalidraw',
      '@excalidraw/markdown-to-text'
    ]
  }
});
