import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// 網站由 Cloudflare Worker 提供（見 wrangler.jsonc），跟 API 同一個網址。
// 開發時 /api 轉給本機的 Worker（npx wrangler dev，預設 8787 port）
export default defineConfig({
  base: './',
  server: { proxy: { '/api': 'http://localhost:8787' } },
  preview: { proxy: { '/api': 'http://localhost:8787' } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '旅行手帖',
        short_name: '旅行手帖',
        description: '兩個人的旅遊行程表',
        lang: 'zh-Hant-TW',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#fff4de',
        theme_color: '#fff4de',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // API 一律走網路：行程資料要登入才拿得到，不能被快取成離線網頁
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
