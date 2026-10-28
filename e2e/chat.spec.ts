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
  // 一開始就有一筆舊紀錄：第一次打開時它會被當成看過，之後才測得出「自己套用不通知自己」
  let log = [{ version: 0, at: '2026-10-20T01:00:00Z', source: 'sync', summary: '從程式碼同步', changes: [] }]
  await page.route(`${API}/api/trips`, (r) => r.fulfill({ json: { trips: [{ version, trip: current, log }] } }))
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
    log = [{ version, at: new Date().toISOString(), source: 'ai', summary: '新增延南洞咖啡廳', changes: [] }, ...log]
    return r.fulfill({ json: { version, trip: current, changes: [], log } })
  })
  let undos = 0
  await page.route(`${API}/api/trips/seoul-2026-11/undo`, (r) => {
    undos += 1
    current = seoul2026
    version += 1
    log = [{ version, at: new Date().toISOString(), source: 'undo', summary: '復原：新增延南洞咖啡廳', changes: [] }, ...log]
    return r.fulfill({ json: { version, trip: current, summary: '復原：新增延南洞咖啡廳', log } })
  })
  return { undos: () => undos }
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
  // 自己套用的修改不用通知自己
  await expect(page.getByRole('button', { name: /^行程動態/ })).toHaveAccessibleName('行程動態')
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

test('複製回覆與整段對話：排版符號換成一般文字，附上來源', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await mockApi(page)
  await page.goto(`./${trip}`)
  await page.getByRole('button', { name: '打開旅行小幫手' }).click()
  const dialog = page.getByRole('dialog', { name: '旅行小幫手' })
  await dialog.getByPlaceholder('通關密語').fill('letmein')
  await dialog.getByRole('button', { name: '開始聊天' }).click()
  await dialog.getByRole('textbox', { name: '訊息' }).fill('推薦咖啡廳')
  await dialog.getByRole('button', { name: '送出' }).click()
  await expect(dialog.getByRole('button', { name: '套用' })).toBeVisible()

  const clipboard = () => page.evaluate(() => navigator.clipboard.readText())
  await dialog.getByRole('button', { name: '複製回覆' }).click()
  await expect(dialog.getByRole('button', { name: '已複製' })).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/chat-copy.png' })
  const reply = await clipboard()
  expect(reply).toContain('找到一間不錯的店，11/7 早上可以去。')
  expect(reply).not.toContain('**')
  expect(reply).toContain('建議修改：新增延南洞咖啡廳')
  expect(reply).toContain('來源：\n・Example 咖啡指南 https://example.com/cafe')

  await dialog.getByRole('button', { name: '複製整段對話' }).click()
  expect(await clipboard()).toMatch(/^我：\n推薦咖啡廳\n\n小樹：\n找到一間不錯的店/)
})

test('附圖：在手機上縮成 JPEG 才上傳，下一則訊息不重傳', async ({ page }) => {
  const bodies: { messages: { text: string; images?: { mimeType: string; data: string }[] }[] }[] = []
  await page.addInitScript(() => localStorage.setItem('trip-chat', JSON.stringify({ state: { passcode: 'x', threads: {} }, version: 1 })))
  await page.route(`${API}/api/trips`, (r) => r.fulfill({ json: { trips: [{ version: 0, trip: seoul2026, log: [] }] } }))
  await page.route(`${API}/api/chat`, (r) => {
    bodies.push(r.request().postDataJSON())
    const events = [{ type: 'text', delta: '看到了，營業到 24:00。' }, { type: 'done' }]
    return r.fulfill({ contentType: 'text/event-stream', body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') })
  })
  await page.goto(`./${trip}`)
  await page.getByRole('button', { name: '打開旅行小幫手' }).click()
  const dialog = page.getByRole('dialog', { name: '旅行小幫手' })

  // 3000×1500 的 PNG：應該縮到長邊 2048 的 JPEG
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 3000
    c.height = 1500
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#97D7FF'
    ctx.fillRect(0, 0, 3000, 1500)
    const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/png'))
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await dialog.getByLabel('選擇圖片').setInputFiles({ name: 'hours.png', mimeType: 'image/png', buffer: Buffer.from(png) })
  await expect(dialog.getByRole('img', { name: '要附的圖 1' })).toBeVisible()
  await dialog.getByRole('button', { name: '送出' }).click()

  await expect(dialog.getByText('看到了，營業到 24:00。')).toBeVisible()
  await expect(dialog.getByRole('img', { name: '附圖 1' })).toBeVisible()
  const sent = bodies[0].messages.at(-1)!
  expect(sent.text).toBe('請看圖片')
  expect(sent.images).toHaveLength(1)
  expect(sent.images![0].mimeType).toBe('image/jpeg')
  const size = await page.evaluate(async (data) => {
    const img = new Image()
    img.src = `data:image/jpeg;base64,${data}`
    await img.decode()
    return [img.naturalWidth, img.naturalHeight]
  }, sent.images![0].data)
  expect(size).toEqual([2048, 1024])

  await dialog.getByRole('textbox', { name: '訊息' }).fill('那最後點餐呢？')
  await dialog.getByRole('button', { name: '送出' }).click()
  await expect.poll(() => bodies.length).toBe(2)
  const second = bodies[1].messages
  expect(second.at(-1)!.images ?? []).toHaveLength(0)
  expect(second[0].text).toContain('當時附了 1 張圖')
  expect(second.some((m) => m.images?.length)).toBe(false)
})

test('復原要再確認一次，寫出復原的是哪一次修改', async ({ page }) => {
  const api = await mockApi(page)
  await page.addInitScript(() => localStorage.setItem('trip-chat', JSON.stringify({ state: { passcode: 'letmein', threads: {} }, version: 1 })))
  await page.goto(`./${trip}`)
  await page.getByRole('button', { name: '打開旅行小幫手' }).click()
  const dialog = page.getByRole('dialog', { name: '旅行小幫手' })
  // 右上角不再有容易跟重新整理搞混的圖示
  await expect(dialog.getByRole('button', { name: '復原上一次修改' })).toHaveCount(0)
  await dialog.getByRole('textbox', { name: '訊息' }).fill('加咖啡廳')
  await dialog.getByRole('button', { name: '送出' }).click()
  await dialog.getByRole('button', { name: '套用' }).click()
  await expect(dialog.getByText('已套用到行程')).toBeVisible()

  await dialog.getByRole('button', { name: '復原這次修改' }).click()
  expect(api.undos()).toBe(0)
  await expect(dialog.getByText('確定要復原「新增延南洞咖啡廳」嗎？')).toBeVisible()
  await dialog.getByRole('button', { name: '復原', exact: true }).click()
  await expect(dialog.getByText('已復原，行程回到這次修改之前')).toBeVisible()
  expect(api.undos()).toBe(1)
  await dialog.getByRole('button', { name: '關閉' }).click()
  await page.getByRole('button', { name: /DAY 2/ }).click()
  await expect(page.getByRole('heading', { name: '延南洞咖啡廳 TEST' })).toHaveCount(0)
})
