import { expect, test, type Page } from '@playwright/test'
import { applyOps } from '../src/lib/ops'
import { seoul2026 } from '../src/trips/seoul-2026-11'

// 聊天框的端對端測試：後端全部用 page.route 模擬，不會真的呼叫 Gemini
const API = 'https://trip-chat.travel-planner-hm1d.workers.dev'
const trip = '#/trip/seoul-2026-11'
const ops = [{ op: 'add_item' as const, date: '2026-11-07', item: { time: '11:00', kind: 'food' as const, title: '延南洞咖啡廳 TEST', tentative: true } }]

async function mockApi(page: Page) {
  let version = 0
  let current = seoul2026
  await page.route(`${API}/api/trips`, (r) => r.fulfill({ json: { trips: [{ version, trip: current }] } }))
  await page.route(`${API}/api/auth`, (r) =>
    r.request().headers().authorization === 'Bearer letmein' ? r.fulfill({ json: { ok: true } }) : r.fulfill({ status: 401, json: { error: '通關密語不對' } }),
  )
  await page.route(`${API}/api/chat`, (r) => {
    const changes = applyOps(current, ops).changes
    const events = [
      { type: 'status', text: '搜尋：延南洞 咖啡廳' },
      { type: 'sources', sources: [{ title: 'Example 咖啡指南', url: 'https://example.com/cafe' }] },
      { type: 'text', delta: '找到一間不錯的店，' },
      { type: 'text', delta: '**11/7 早上**可以去。' },
      { type: 'proposal', proposal: { id: 'p1', summary: '新增延南洞咖啡廳', ops, changes, baseVersion: version } },
      { type: 'done' },
    ]
    return r.fulfill({ contentType: 'text/event-stream', body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') })
  })
  await page.route(`${API}/api/trips/seoul-2026-11/apply`, (r) => {
    current = applyOps(current, ops).trip
    version += 1
    return r.fulfill({ json: { version, trip: current, changes: [] } })
  })
}

test('通關密語 → 聊天 → 套用修改 → 行程上看得到', async ({ page }) => {
  await mockApi(page)
  await page.goto(`./${trip}`)
  await page.getByRole('button', { name: '打開旅行小幫手' }).click()

  const dialog = page.getByRole('dialog', { name: '旅行小幫手' })
  await dialog.getByPlaceholder('通關密語').fill('wrong')
  await dialog.getByRole('button', { name: '開始聊天' }).click()
  await expect(dialog.getByText('通關密語不對')).toBeVisible()
  await dialog.getByPlaceholder('通關密語').fill('letmein')
  await dialog.getByRole('button', { name: '開始聊天' }).click()

  await expect(dialog.getByText('嗨！我是小樹')).toBeVisible()
  await dialog.getByRole('textbox', { name: '訊息' }).fill('11/7 早上加一間咖啡廳')
  await dialog.getByRole('button', { name: '送出' }).click()

  await expect(dialog.getByText('搜尋：延南洞 咖啡廳')).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Example 咖啡指南' })).toBeVisible()
  await expect(dialog.locator('strong', { hasText: '11/7 早上' })).toBeVisible()
  await expect(dialog.getByText('11/7 11:00「延南洞咖啡廳 TEST」')).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/chat.png' })

  await dialog.getByRole('button', { name: '套用' }).click()
  await expect(dialog.getByText('已套用到行程')).toBeVisible()
  await dialog.getByRole('button', { name: '關閉' }).click()

  await page.getByRole('button', { name: /11\/7/ }).click()
  await expect(page.getByText('延南洞咖啡廳 TEST')).toBeVisible()

  // 重新整理後：密語還記得、對話還在、行程是新版本
  await page.reload()
  await page.getByRole('button', { name: /11\/7/ }).click()
  await expect(page.getByText('延南洞咖啡廳 TEST')).toBeVisible()
  await page.getByRole('button', { name: '打開旅行小幫手' }).click()
  await expect(dialog.getByText('已套用到行程')).toBeVisible()
})

test('後端連不上時，用網站內建的行程照常顯示', async ({ page }) => {
  await page.route(`${API}/**`, (r) => r.abort())
  await page.goto(`./${trip}`)
  await expect(page.getByRole('heading', { name: '落地直奔場館' })).toBeVisible()
})
