import { defineConfig } from '@playwright/test'

// 登入的端對端測試：真的 Worker（本機模擬 Cloudflare、資料放在暫存的本機 KV）＋ Chrome 的虛擬 passkey 裝置。
// 不會碰到線上資料。npm run test:auth
export const AUTH_PORT = 8788
export const AUTH_STATE = '.wrangler/auth-test-state'

export default defineConfig({
  testDir: 'e2e-auth',
  use: { browserName: 'chromium', channel: 'chrome', baseURL: `http://localhost:${AUTH_PORT}/` },
  webServer: {
    command: `rm -rf ${AUTH_STATE} && npm run build && npx wrangler dev --port ${AUTH_PORT} --local --persist-to ${AUTH_STATE} --show-interactive-dev-session=false`,
    url: `http://localhost:${AUTH_PORT}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
