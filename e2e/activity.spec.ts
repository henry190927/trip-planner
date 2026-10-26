import { expect, test, type Page } from '@playwright/test'
import { seoul2026 } from '../src/trips/seoul-2026-11'

// 右上角的行程動態：後端用 page.route 模擬
const API = 'https://trip-chat.travel-planner-hm1d.workers.dev'
const trip = '#/trip/seoul-2026-11'

const older = { version: 1, at: '2026-10-20T01:00:00Z', source: 'sync', summary: '從程式碼同步', changes: [] }
const fromOther = {
  version: 2,
  at: new Date().toISOString(),
  source: 'ai',
  summary: '加一間咖啡廳',
  changes: [{ kind: 'add', text: '11/7 11:00「延南洞咖啡廳 TEST」', date: '2026-11-07' }],
}

async function mockTrips(page: Page, state: { log: object[] }) {
  await page.route(`${API}/api/trips`, (r) =>
    r.fulfill({ json: { trips: [{ version: (state.log[0] as { version: number }).version, trip: seoul2026, log: state.log }] } }),
  )
}

test('另一台裝置改了行程：鈴鐺出現數字，點開看得到內容，點變動跳到那一天', async ({ page }) => {
  const state = { log: [older] as object[] }
  await mockTrips(page, state)
  await page.goto(`./${trip}`)

  // 第一次打開：之前的紀錄都算看過
  const bell = page.getByRole('button', { name: /^行程動態/ })
  await expect(bell).toHaveAccessibleName('行程動態')

  // 另一台裝置套用了修改，這台重新整理後看到
  state.log = [fromOther, older]
  await page.reload()
  await expect(bell).toHaveAccessibleName('行程動態，1 則新的')
  await expect(bell.getByText('1')).toBeVisible()

  await bell.click()
  const panel = page.getByRole('dialog', { name: '行程動態' })
  await expect(panel.getByText('加一間咖啡廳')).toBeVisible()
  await expect(panel.getByText('新', { exact: true })).toBeVisible()
  await expect(panel.getByText('從程式碼同步')).toBeVisible()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'e2e/screenshots/activity.png' })

  await panel.getByRole('link', { name: /延南洞咖啡廳 TEST/ }).click()
  await expect(panel).toBeHidden()
  await expect(page.getByRole('button', { name: /DAY 2/ })).toHaveAttribute('aria-pressed', 'true')
  // 看過了就不再顯示數字，重新整理也一樣
  await expect(bell).toHaveAccessibleName('行程動態')
  await page.reload()
  await expect(page.getByRole('button', { name: /^行程動態/ })).toHaveAccessibleName('行程動態')
})

test('還沒有任何變動時顯示空狀態', async ({ page }) => {
  await page.route(`${API}/api/trips`, (r) => r.fulfill({ json: { trips: [{ version: 0, trip: seoul2026, log: [] }] } }))
  await page.goto(`./${trip}`)
  await page.getByRole('button', { name: '行程動態' }).click()
  await expect(page.getByRole('dialog', { name: '行程動態' }).getByText('還沒有任何變動')).toBeVisible()
})
