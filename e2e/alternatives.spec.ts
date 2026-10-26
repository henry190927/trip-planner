import { expect, test, type Page } from '@playwright/test'
import { applyOps, type Op } from '../src/lib/ops'
import { seoul2026 } from '../src/trips/seoul-2026-11'

// 備案：後端用 page.route 模擬，套用時真的跑 applyOps
const API = 'https://trip-chat.travel-planner-hm1d.workers.dev'
const trip = '#/trip/seoul-2026-11'

async function mockApi(page: Page, { passcode = true } = {}) {
  let version = 4
  let current = seoul2026
  const sent: { ops: Op[]; source?: string }[] = []
  if (passcode)
    await page.addInitScript(() => localStorage.setItem('trip-chat', JSON.stringify({ state: { passcode: 'x', threads: {} }, version: 1 })))
  await page.route(`${API}/api/trips`, (r) => r.fulfill({ json: { trips: [{ version, trip: current, log: [] }] } }))
  await page.route(`${API}/api/trips/seoul-2026-11/apply`, (r) => {
    const body = r.request().postDataJSON() as { ops: Op[]; source?: string }
    sent.push(body)
    const result = applyOps(current, body.ops)
    if (result.errors.length) return r.fulfill({ status: 409, json: { error: '對不起來', details: result.errors } })
    current = result.trip
    version += 1
    return r.fulfill({ json: { version, trip: current, changes: result.changes, log: [] } })
  })
  return sent
}

test('遇到狀況：點「下雨」只展開對應的備案，改用之後可以換回原本的', async ({ page }) => {
  const sent = await mockApi(page)
  await page.goto(`./${trip}`)
  await page.getByRole('button', { name: /DAY 2/ }).click()

  const bar = page.getByText('遇到狀況？點一下看有哪些備案').locator('..')
  await expect(bar.getByRole('button')).toHaveText(['客滿 1', '下雨 1', '太累 1', '晚到 1'])
  await bar.getByRole('button', { name: '下雨 1' }).click()

  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '自由時間：京義線林蔭道・望遠市場' }) })
  await expect(card.getByText('自由時間：逛 AK& 弘大')).toBeVisible()
  // 只展開下雨的，太累的那個先不顯示
  await expect(card.getByText('回住宿休息')).toHaveCount(0)
  await page.waitForTimeout(600)
  // 自動捲到有備案的那一項
  await expect(card).toBeInViewport()
  await page.screenshot({ path: 'e2e/screenshots/alternatives.png' })

  // 自動展開的也收得起來，再打開會列出全部
  const toggle = card.getByRole('button', { name: /備案 2/ })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(card.getByText('自由時間：逛 AK& 弘大')).toHaveCount(0)
  await toggle.click()
  await expect(card.getByText('回住宿休息')).toBeVisible()

  await card.getByRole('button', { name: '改用這個' }).first().click()
  await card.getByRole('button', { name: /確定換成/ }).click()
  await expect(page.getByRole('heading', { name: '自由時間：逛 AK& 弘大' })).toBeVisible()
  expect(sent[0]).toMatchObject({ source: 'manual', ops: [{ op: 'use_alternative', index: 0 }] })

  const now = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '自由時間：逛 AK& 弘大' }) })
  await expect(now.getByText('已改用備案')).toBeVisible()
  await now.getByRole('button', { name: /其他安排/ }).click()
  await now.getByRole('button', { name: '換回原本的' }).click()
  await now.getByRole('button', { name: /確定換成/ }).click()
  await expect(page.getByRole('heading', { name: '自由時間：京義線林蔭道・望遠市場' })).toBeVisible()
})

test('還沒輸入通關密語時，改用備案會提示先輸入', async ({ page }) => {
  await mockApi(page, { passcode: false })
  await page.goto(`./${trip}`)
  await page.getByRole('button', { name: /DAY 2/ }).click()
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'MISS 豬腳宵夜' }) })
  await card.getByRole('button', { name: /備案 2/ }).click()
  await card.getByRole('button', { name: '改用這個' }).first().click()
  await card.getByRole('button', { name: /確定換成/ }).click()
  await expect(card.getByText('要先在小樹那邊輸入通關密語')).toBeVisible()
})
