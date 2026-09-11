import tailwindcss from '@tailwindcss/postcss';
import { readFileSync } from 'node:fs';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({
  // Embed the refreshed snapshot in both development and production bundles.
  // Public assets cannot be imported as modules by Vite's development server.
  define: {
    __KARUME_CATALOG__: readFileSync(new URL('./public/collections.json', import.meta.url), 'utf8'),
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext()],
  server: { host: '127.0.0.1' },
});
