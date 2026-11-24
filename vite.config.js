import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

// Только для npm run dev: сайт присылает сюда комнату и лампы для запекания света в Blender
// (__app.exportForBake() в консоли) — файлы ложатся в models-src/bake/ (только локально).
function bakeExport() {
  return {
    name: 'bake-export',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__bake/', (req, res) => {
        const name = path.basename(req.url.split('?')[0]);
        if (req.method !== 'POST' || !/^[\w.-]+$/.test(name)) {
          res.statusCode = 400;
          return res.end();
        }
        const dir = path.resolve('models-src/bake');
        fs.mkdirSync(dir, { recursive: true });
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  // Пути относительные: собранный сайт можно положить в любую папку (например, на GitHub Pages).
  base: './',
  plugins: [bakeExport()],
  build: {
    // Three.js сам по себе весит ~650 КБ (≈175 КБ в сжатом виде) — для 3D-сайта это нормально.
    chunkSizeWarningLimit: 900,
  },
});
