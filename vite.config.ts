import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { apiDevPlugin } from './scripts/vite-plugin-api-dev'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  server: {
    proxy: {
      // Dev: browser calls same origin `/api/*` → forwards to Hono API (npm run api:dev)
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    apiDevPlugin(),
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // main.tsx registers via usePWA.ts (avoid duplicate registerSW.js injection)
      injectRegister: false,
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      
      // Manifest configuration
      manifest: {
        name: 'JRC SportSync',
        short_name: 'SportSync',
        description: 'Sports facility reservation and management system',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0f172a',
        background_color: '#020617',
        orientation: 'portrait-primary',
        
        // Icons - multiple sizes for different devices
        icons: [
          {
            src: '/pwa-icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-icons/icon-192x192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-icons/icon-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        
        // Screenshots for install prompt
        screenshots: [
          {
            src: '/pwa-screenshots/screenshot-1.png',
            sizes: '540x720',
            type: 'image/png',
            form_factor: 'narrow',
          },
          {
            src: '/pwa-screenshots/screenshot-2.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
          },
        ],
        
        // App shortcuts for quick actions
        shortcuts: [
          {
            name: 'View My Bookings',
            short_name: 'Bookings',
            description: 'View your sports facility bookings',
            url: '/my-bookings',
            icons: [
              {
                src: '/pwa-icons/shortcut-bookings-192.png',
                sizes: '192x192',
              },
            ],
          },
          {
            name: 'Make a Booking',
            short_name: 'New Booking',
            description: 'Create a new sports facility booking',
            url: '/booking',
            icons: [
              {
                src: '/pwa-icons/shortcut-booking-192.png',
                sizes: '192x192',
              },
            ],
          },
        ],
      },
      
      devOptions: {
        enabled: true,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
