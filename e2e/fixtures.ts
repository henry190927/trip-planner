import { test as base, expect } from '@playwright/test'
import { seoul2026 } from '../test/fixtures/seoul-2026-11'

// 所有 e2e 測試共用：預設已經登入，後端回傳測試用的行程。
// 個別測試要不同的回應時，自己再 page.route 一次（後註冊的優先）
export const testUser = {
  id: 'u1',
  name: '我',
  credentials: [
    { id: 'cred-iphone', label: 'iPhone', createdAt: '2026-11-21T00:00:00Z', lastUsedAt: '2026-11-21T00:00:00Z' },
    { id: 'cred-mac', label: 'Mac', createdAt: '2026-11-20T00:00:00Z' },
  ],
}

export const test = base.extend<{ signedIn: void }>({
  signedIn: [
    async ({ page }, use) => {
      await page.route('**/api/me', (r) => r.fulfill({ json: { user: testUser } }))
      await page.route('**/api/trips', (r) => r.fulfill({ json: { trips: [{ version: 0, trip: seoul2026, log: [] }] } }))
      await use()
    },
    { auto: true },
  ],
})

export { expect }
export type { Page } from '@playwright/test'
