import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const api = process.env.VITE_API_URL || 'http://localhost:5050';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared') } },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/api': api, '/exports': api },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
