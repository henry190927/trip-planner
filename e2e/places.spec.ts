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

test.describe('編輯、刪除、新增地點', () => {
  test.beforeEach(async ({ page }) => {
    await page.unrouteAll()
    const API = 'https://trip-chat.travel-planner-hm1d.workers.dev'
    const { applyOps } = await import('../src/lib/ops')
    const { seoul2026 } = await import('../src/trips/seoul-2026-11')
    let current = seoul2026
    let version = 7
    await page.addInitScript(() => localStorage.setItem('trip-chat', JSON.stringify({ state: { passcode: 'x', threads: {} }, version: 1 })))
    await page.route(`${API}/api/trips`, (r) => r.fulfill({ json: { trips: [{ version, trip: current, log: [] }] } }))
    await page.route(`${API}/api/trips/seoul-2026-11/apply`, (r) => {
      const body = r.request().postDataJSON()
      const result = applyOps(current, body.ops)
      if (result.errors.length) return r.fulfill({ status: 409, json: { error: '這個修改跟目前的行程對不起來', details: result.errors } })
      current = result.trip
      version += 1
      return r.fulfill({ json: { version, trip: current, changes: result.changes, log: [] } })
    })
  })

  test('編輯營業時間會顯示確認日期', async ({ page }) => {
    await page.goto(`./${trip}/places`)
    await page.getByRole('button', { name: '編輯「MEGA COFFEE 弘大入口站店」' }).click()
    const dialog = page.getByRole('dialog', { name: '編輯地點' })
    await expect(dialog.getByLabel('名稱', { exact: true })).toHaveValue('MEGA COFFEE 弘大入口站店')
    await dialog.getByLabel('營業時間').fill('08:00–22:00')
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'e2e/screenshots/spot-editor.png' })
    await dialog.getByRole('button', { name: '儲存' }).click()
    await expect(dialog).toBeHidden()
    const card = page.locator('#spot-mega-coffee')
    await expect(card.getByText('08:00–22:00')).toBeVisible()
    await expect(card.getByText(/確認$/)).toBeVisible()
  })

  test('已排進行程的地點刪不掉，口袋名單的可以', async ({ page }) => {
    await page.goto(`./${trip}/places`)
    const jokbal = page.locator('#spot-miss-jokbal')
    await jokbal.getByRole('button', { name: /^刪除「/ }).click()
    await jokbal.getByRole('button', { name: '刪除', exact: true }).click()
    await expect(jokbal.getByText(/還排在行程裡/)).toBeVisible()

    const mega = page.locator('#spot-mega-coffee-2')
    await mega.getByRole('button', { name: /^刪除「/ }).click()
    await mega.getByRole('button', { name: '刪除', exact: true }).click()
    await expect(mega).toHaveCount(0)
  })

  test('自己新增一個地點，出現在口袋名單', async ({ page }) => {
    await page.goto(`./${trip}/places`)
    await page.getByRole('button', { name: '自己新增' }).click()
    const dialog = page.getByRole('dialog', { name: '新增地點' })
    await dialog.getByLabel('名稱', { exact: true }).fill('測試咖啡')
    await dialog.getByRole('radio', { name: '咖啡・飲料' }).click()
    await dialog.getByLabel('地區').fill('延南洞')
    await dialog.getByRole('button', { name: '儲存' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('heading', { name: '測試咖啡' })).toBeVisible()
    await expect(page.getByText('已排進行程 6・口袋名單 3')).toBeVisible()
  })
})
