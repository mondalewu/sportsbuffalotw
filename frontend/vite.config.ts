import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['標頭.jpg', 'icons/*.png'],
      manifest: {
        name: '水牛體育 SPORTS BUFFALO',
        short_name: '水牛體育',
        description: '台灣最即時的體育新聞平台，棒球、中職、日職、WBC 賽事資訊',
        theme_color: '#dc2626',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'zh-TW',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'CPBL 中華職棒',
            url: '/cpbl',
            description: '中華職棒賽程與比分',
          },
          {
            name: 'NPB 日本職棒',
            url: '/npb',
            description: '日本職棒賽程與比分',
          },
        ],
        categories: ['sports', 'news'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /\/api\/v1\/(games|articles)\b/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
  server: mode === 'development' ? {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  } : undefined,
}))
