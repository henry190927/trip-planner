import { applyOps, type Op } from '../src/lib/ops'
import { blankTrip } from '../src/lib/sectionOps'
import { seoul2026 } from '../test/fixtures/seoul-2026-11'
import { expect, test } from './fixtures'

// 用小樹建立新行程：小樹在空白草稿上提修改，按「套用」時後端建立行程（後端用 page.route 模擬）
const ops: Op[] = [
  { op: 'update_trip', tripChanges: { title: '釜山', subtitle: '生日旅行', timezone: 'Asia/Seoul', mapProvider: 'naver' } },
  { op: 'set_dates', startDate: '2026-12-22', endDate: '2026-12-26' },
  { op: 'update_day', date: '2026-12-23', dayChanges: { title: '海雲台散步' } },
  { op: 'add_pending', text: '班機' },
]

test('首頁用小樹建立新行程：套用後直接打開新的行程', async ({ page }) => {
  const draft = blankTrip(['我'], '2026-11-21')
  const created = { ...applyOps(draft, ops).trip, id: 'busan-2026-12' }
  let chatBody: Record<string, unknown> = {}
  await page.route('**/api/chat', (r) => {
    chatBody = r.request().postDataJSON() as Record<string, unknown>
    const changes = applyOps(draft, ops).changes
    const events = [
      { type: 'text', delta: '幫你建好釜山的行程了。' },
      { type: 'proposal', proposal: { id: 'p1', summary: '建立釜山行程', ops, changes, baseVersion: 0, createTripId: 'busan-2026-12' } },
      { type: 'done' },
    ]
    return r.fulfill({ contentType: 'text/event-stream', body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') })
  })
  let createBody: Record<string, unknown> = {}
  let trips = [{ version: 0, trip: seoul2026, log: [] as unknown[] }]
  await page.route('**/api/trips', (r) => {
    if (r.request().method() === 'POST') {
      createBody = r.request().postDataJSON() as Record<string, unknown>
      const v = { version: 1, trip: created, log: [] }
      trips = [...trips, v]
      return r.fulfill({ json: { ...v, changes: [] } })
    }
    return r.fulfill({ json: { trips } })
  })

  await page.goto('./#/')
  await page.getByRole('button', { name: /用小樹建立新行程/ }).click()
  const dialog = page.getByRole('dialog', { name: '旅行小幫手' })
  await expect(dialog.getByText('建立新行程')).toBeVisible()
  await expect(dialog.getByText('一起規劃新的旅行')).toBeVisible()
  await dialog.getByRole('textbox', { name: '訊息' }).fill('12/22–12/26 去釜山')
  await dialog.getByRole('button', { name: '送出' }).click()
  await expect(dialog.getByText('旅程日期：12/22 – 12/26')).toBeVisible()
  expect(chatBody).toMatchObject({ newTrip: true })
  expect(chatBody.tripId).toBeUndefined()

  await dialog.getByRole('button', { name: '套用' }).click()
  await expect(page).toHaveURL(/#\/trip\/busan-2026-12/)
  await expect(page.getByRole('heading', { name: '海雲台散步' }).or(page.getByText('釜山').first())).toBeVisible()
  expect(createBody).toMatchObject({ tripId: 'busan-2026-12', summary: '建立釜山行程' })
  expect((createBody.ops as Op[]).length).toBe(4)
})

test('還沒有航班、住宿、交通時：顯示請小樹幫忙加，按了打開聊天框並先填好', async ({ page }) => {
  const empty = { ...seoul2026, flights: [], stays: [], routes: [] }
  // 有連到路線的項目要拿掉，不然資料不完整
  empty.days = empty.days.map((d) => ({ ...d, items: d.items.map(({ routeId: _r, ...i }) => ({ ...i, alternatives: i.alternatives?.map(({ routeId: _a, ...a }) => a) })) }))
  await page.route('**/api/trips', (r) => r.fulfill({ json: { trips: [{ version: 1, trip: empty, log: [] }] } }))
  await page.goto('./#/trip/seoul-2026-11/info')
  await expect(page.getByText('還沒有航班的資料。')).toBeVisible()
  await expect(page.getByText('還沒有住宿的資料。')).toBeVisible()
  await page.getByRole('button', { name: '請小樹幫忙加' }).first().click()
  const dialog = page.getByRole('dialog', { name: '旅行小幫手' })
  await expect(dialog.getByRole('textbox', { name: '訊息' })).toHaveValue('我把機票的截圖附上，幫我加進航班和行程')
  await dialog.getByRole('button', { name: '關閉' }).click()
  await page.goto('./#/trip/seoul-2026-11/routes')
  await expect(page.getByText('還沒有交通指南的資料。')).toBeVisible()
})
