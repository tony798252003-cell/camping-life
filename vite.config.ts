import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.jpg', 'images/*.png'],
      // 推播 handler（push／notificationclick）放在 public/push-sw.js，由 generateSW 產生的 sw 載入
      workbox: { importScripts: ['push-sw.js'] },
      manifest: {
        name: '搭帳日誌',
        short_name: '搭帳日誌',
        description: '記錄每一次美好的露營時刻',
        theme_color: '#e0f2fe',
        background_color: '#f0f9ff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
  },
})
