import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'CheckDoku PWA',
        short_name: 'CheckDoku',
        description: 'Prueba de matriz con reglas por color',
        theme_color: '#111827',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'vite.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' }
        ]
      }
    })
  ],
})
