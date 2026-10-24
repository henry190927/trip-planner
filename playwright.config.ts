import { defineConfig, devices } from '@playwright/test'

// 用本機的 Chrome 跑 iPhone 尺寸，不另外下載瀏覽器
export default defineConfig({
  testDir: 'e2e',
  use: {
    ...devices['iPhone 15'],
    browserName: 'chromium',
    channel: 'chrome',
    baseURL: 'http://localhost:4173/',
    timezoneId: 'Asia/Taipei',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
  },
})
