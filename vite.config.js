import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the build from https://rietiu.github.io/poker-tracker/,
// so production assets/routes live under /poker-tracker/ (build and preview).
// The dev server stays at / so the LAN URL used on the phone is unchanged.
const PAGES_BASE = '/poker-tracker/'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => {
  const base = command === 'build' || isPreview ? PAGES_BASE : '/'
  return {
  base,
  plugins: [
    react(),
    VitePWA({
      // Ask before swapping in a new build so a reload never interrupts hand entry.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-64.png'],
      manifest: {
        name: 'Poker Tracker',
        short_name: 'Poker',
        description: 'Track your poker hands offline',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d1117',
        theme_color: '#2d6a4f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Every route is client-side (react-router) — serve the app shell offline.
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  }
})
