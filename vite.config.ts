import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages: https://<user>.github.io/agaemi-kassa/
const BASE = process.env.VITE_BASE ?? '/agaemi-kassa/';

// GitHub Pages SPA fallback: unknown deep links (e.g. /agaemi-kassa/add) are served
// from 404.html — which is just a copy of index.html, so the router takes over.
function spaFallback404(): Plugin {
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    closeBundle() {
      const dist = resolve(import.meta.dirname, 'dist');
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: BASE,
        name: 'Agaemi Kassa',
        short_name: 'Kassa',
        description: 'Şəxsi büdcə — mədaxil, məxaric, statistika',
        lang: 'az',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#16a34a',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android: long-press the home-screen icon → direct entry to the add screen
        shortcuts: [
          {
            name: 'Məxaric əlavə et',
            short_name: 'Məxaric',
            url: `${BASE}add?type=expense`,
            icons: [{ src: 'icons/shortcut-expense.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Mədaxil əlavə et',
            short_name: 'Mədaxil',
            url: `${BASE}add?type=income`,
            icons: [{ src: 'icons/shortcut-income.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
    spaFallback404(),
  ],
});
