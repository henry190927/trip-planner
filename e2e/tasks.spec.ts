import { expect, test, type Page } from '@playwright/test'
import { applyOps, type Op } from '../src/lib/ops'
import { seoul2026 } from '../src/trips/seoul-2026-11'

// 小任務：後端用 page.route 模擬，套用時真的跑 applyOps
const API = 'https://trip-chat.travel-planner-hm1d.workers.dev'
const trip = '#/trip/seoul-2026-11'
const day2 = '2026-11-07'

const base = applyOps(seoul2026, [
  {
    op: 'add_item',
    date: day2,
    item: {
      time: '19:00',
      end: '19:40',
      kind: 'task',
      title: '外帶 MISS 豬腳回住宿',
      who: ['me'],
      todo: { done: false },
      for: { time: '21:30', title: 'MISS 豬腳宵夜' },
      private: true,
    },
  },
  { op: 'add_item', date: day2, item: { time: '15:00', kind: 'task', title: '應援棒換電池', who: ['her'], todo: { done: false } } },
]).trip

async function mockApi(page: Page) {
  let current = base
  let version = 9
  const sent: Op[][] = []
  await page.addInitScript(() => localStorage.setItem('trip-chat', JSON.stringify({ state: { passcode: 'x', threads: {} }, version: 1 })))
  await page.route(`${API}/api/trips`, (r) => r.fulfill({ json: { trips: [{ version, trip: current, log: [] }] } }))
  await page.route(`${API}/api/trips/seoul-2026-11/apply`, (r) => {
    const body = r.request().postDataJSON() as { ops: Op[] }
    sent.push(body.ops)
    const result = applyOps(current, body.ops)
    current = result.trip
    version += 1
    return r.fulfill({ json: { version, trip: current, changes: result.changes, log: [] } })
  })
  return sent
}

test('私人小任務只有負責人選自己時看得到；打勾會寫回後端', async ({ page }) => {
  const sent = await mockApi(page)
  await page.goto(`./${trip}`)
  await page.getByRole('button', { name: /DAY 2/ }).click()
  // 等前一天的畫面退場（動畫期間兩天的按鈕會同時存在）
  await expect(page.getByRole('radiogroup', { name: '看誰的行程' })).toHaveCount(1)

  // 選「全部」：看得到她的一般小任務，看不到我的私人小任務
  await expect(page.getByRole('heading', { name: '應援棒換電池' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '外帶 MISS 豬腳回住宿' })).toHaveCount(0)
  await page.getByRole('radio', { name: '她' }).click()
  await expect(page.getByRole('heading', { name: '外帶 MISS 豬腳回住宿' })).toHaveCount(0)

  await page.getByRole('radio', { name: '我' }).click()
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '外帶 MISS 豬腳回住宿' }) })
  await expect(card.getByText('私人')).toBeVisible()
  await expect(card.getByText('為了：21:30「MISS 豬腳宵夜」')).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'e2e/screenshots/task.png' })

  const check = card.getByRole('button', { name: '「外帶 MISS 豬腳回住宿」標成完成' })
  await check.click()
  await expect(card.getByRole('button', { name: '「外帶 MISS 豬腳回住宿」改回還沒完成' })).toHaveAttribute('aria-pressed', 'true')
  await expect(card.getByText(/\d{2}:\d{2} 完成/)).toBeVisible()
  expect(sent[0]).toEqual([{ op: 'complete_task', date: day2, title: '外帶 MISS 豬腳回住宿', time: '19:00', done: true }])
})
