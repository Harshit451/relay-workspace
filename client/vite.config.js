import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: clientRoot,
  envDir: clientRoot,
  plugins: [react()],
  build: { outDir: path.join(clientRoot, 'dist'), emptyOutDir: true },
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
});
