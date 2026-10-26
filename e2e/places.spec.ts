import { expect, test } from '@playwright/test'

// 地點分頁：用網站內建的行程（後端連不上時的狀態）
const trip = '#/trip/seoul-2026-11'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (r) => r.abort())
})

test('列出已排進行程與口袋名單，可以依分類篩選，點「已排入」跳到那一天', async ({ page }) => {
  await page.goto(`./${trip}/places`)
  await expect(page.getByRole('heading', { name: '地點清單' })).toBeVisible()
  await expect(page.getByText('已排進行程 6・口袋名單 2')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'MEGA COFFEE 弘大入口站店' })).toBeVisible()
  // 營業時間都還沒有可靠資料：不顯示「現在營業中」篩選，也不亂標營業中
  await expect(page.getByRole('button', { name: /現在營業中/ })).toHaveCount(0)
  await expect(page.getByText('營業中', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'e2e/screenshots/places.png' })

  await page.getByRole('button', { name: /吃 2/ }).click()
  await expect(page.locator('section[id^="spot-"]')).toHaveCount(2)
  await page.getByRole('button', { name: /全部/ }).click()
  await expect(page.locator('section[id^="spot-"]')).toHaveCount(8)

  // 地區按鈕跟著分類走：咖啡裡只有弘大、KBS 周邊各一間，不會出現空的「望遠」
  await page.getByRole('button', { name: /咖啡・飲料 2/ }).click()
  const areaChips = page.getByRole('button', { name: /^(弘大|望遠|KBS Arena 周邊) \d+$/ })
  await expect(areaChips).toHaveText(['弘大 1', 'KBS Arena 周邊 1'])
  await page.getByRole('button', { name: '弘大 1' }).click()
  await expect(page.locator('section[id^="spot-"]')).toHaveCount(1)
  // 選著「弘大」換到「景點」：景點裡沒有弘大，不能變成空的
  await page.getByRole('button', { name: /景點 1/ }).click()
  await expect(page.locator('section[id^="spot-"]')).toHaveCount(1)
  await page.getByRole('button', { name: /全部/ }).click()

  await page.locator('#spot-miss-jokbal').getByText(/已排入 11\/7 21:30/).click()
  await expect(page.getByRole('link', { name: '行程', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: /DAY 2/ })).toHaveAttribute('aria-pressed', 'true')
})

test('口袋名單的「請小樹排進行程」會打開聊天框並先填好', async ({ page }) => {
  // 模擬已經輸入過通關密語
  await page.addInitScript(() => localStorage.setItem('trip-chat', JSON.stringify({ state: { passcode: 'x', threads: {} }, version: 1 })))
  await page.goto(`./${trip}/places`)
  await page.locator('#spot-mega-coffee').getByRole('button', { name: '請小樹排進行程' }).click()
  const dialog = page.getByRole('dialog', { name: '旅行小幫手' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '訊息' })).toHaveValue('幫我把「MEGA COFFEE 弘大入口站店」排進行程')
})
