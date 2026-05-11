import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    VitePWA({
      // Use generateSW strategy instead - simpler, auto-generates service worker
      strategies: 'generateSW',
      
      // Auto-register and update service worker
      registerType: 'autoUpdate',
      
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
      
      // Service worker configuration
      workbox: {
        // Runtime caching strategies
        runtimeCaching: [
          // API calls - network first for real-time data
          {
            urlPattern: /^https:\/\/(api\.example\.com|your-api\.vercel\.app)\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Static assets - cache first
          {
            urlPattern: /^https:\/\/[^/]*\/.*\.(js|css|woff2|ttf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          // Images - cache first with size limit
          {
            urlPattern: /^https:\/\/[^/]*\/.*\.(png|jpg|jpeg|gif|webp|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
        
        // Skip caching for certain requests
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      
      // DevOptions for development
      devOptions: {
        enabled: false, // Set to true to test PWA in dev mode
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
      },
      
      // Disable PWA in dev to avoid caching issues during development
      disable: process.env.NODE_ENV === 'development' || false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
