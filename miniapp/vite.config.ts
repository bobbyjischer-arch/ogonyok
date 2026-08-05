import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
  },
  server: {
    port: 5173,
    // Только для разработки: /api уходит на локальный `wrangler dev`, чтобы
    // vite с горячей перезагрузкой и воркер работали рядом.
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
