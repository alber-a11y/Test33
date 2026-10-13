import { defineConfig } from 'vite';

import pkg from './package.json';

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
