import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        football: fileURLToPath(new URL('./index.html', import.meta.url)),
        basketball: fileURLToPath(new URL('./basketball/index.html', import.meta.url)),
      },
    },
  },
});
