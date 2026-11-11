import { defineConfig } from 'vite';

export default defineConfig({
  // Пути относительные: собранный сайт можно положить в любую папку (например, на GitHub Pages).
  base: './',
  build: {
    // Three.js сам по себе весит ~650 КБ (≈175 КБ в сжатом виде) — для 3D-сайта это нормально.
    chunkSizeWarningLimit: 900,
  },
});
