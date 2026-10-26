import { expect, test } from '@playwright/test'
import { seoul2026 } from '../src/trips/seoul-2026-11'

// 動態調整：快捷按鈕要用「現在幾點」，所以把時鐘固定在旅程中
const API = 'https://trip-chat.travel-planner-hm1d.workers.dev'
const trip = '#/trip/seoul-2026-11'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('trip-chat', JSON.stringify({ state: { passcode: 'x', threads: {} }, version: 1 })))
  await page.route(`${API}/api/trips`, (r) => r.fulfill({ json: { trips: [{ version: 7, trip: seoul2026, log: [] }] } }))
})

test('旅行中：聊天框有快捷按鈕，按了會填好現在時間與下一個固定行程', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-07T13:10:00+09:00'))
  await page.goto(`./${trip}`)
  // 旅行中會直接打開當天；固定的行程有標記
  const concert = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /第二場/ }) })
  await expect(concert.getByText('固定')).toBeVisible()

  await page.getByRole('button', { name: '打開旅行小幫手' }).click()
  const dialog = page.getByRole('dialog', { name: '旅行小幫手' })
  const actions = dialog.getByLabel('旅行中的快捷按鈕').getByRole('button')
  await expect(actions).toHaveText(['晚到了', '早到了', '附近吃的', '下雨了', '好累'])
  await dialog.getByRole('button', { name: '早到了' }).click()
  const box = dialog.getByRole('textbox', { name: '訊息' })
  await expect(box).toHaveValue(/現在是 11\/7 13:10/)
  await expect(box).toHaveValue(/15:30「取票・周邊排隊」/)
  // 填進來的長文字要看得到，輸入框跟著長高
  const height = await box.evaluate((el) => el.clientHeight)
  expect(height).toBeGreaterThan(60)
  await page.screenshot({ path: 'e2e/screenshots/quick-actions.png' })
})

test('出發前沒有快捷按鈕', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-27T12:00:00+09:00'))
  await page.goto(`./${trip}`)
  await page.getByRole('button', { name: '打開旅行小幫手' }).click()
  await expect(page.getByRole('dialog', { name: '旅行小幫手' }).getByLabel('旅行中的快捷按鈕')).toHaveCount(0)
})
