import { expect, test } from '@playwright/test'
import { applyOps, type Op } from '../src/lib/ops'
import { seoul2026 } from '../src/trips/seoul-2026-11'

const API = 'https://trip-chat.travel-planner-hm1d.workers.dev'

test('清單項目可以刪除（要再確認）、改文字（勾選狀態留著）', async ({ page }) => {
  let current = seoul2026
  let version = 32
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
  await page.goto('./#/trip/seoul-2026-11/list')

  const item = page.getByRole('checkbox', { name: 'Kakao T 註冊、綁卡' })
  await expect(item).toBeVisible()
  await page.getByRole('button', { name: '刪除「Kakao T 註冊、綁卡」' }).click()
  expect(sent).toHaveLength(0)
  await expect(page.getByText('從清單刪掉「Kakao T 註冊、綁卡」？')).toBeVisible()
  await page.getByRole('button', { name: '刪除', exact: true }).click()
  await expect(item).toHaveCount(0)
  expect(sent[0]).toEqual([{ op: 'remove_checklist_item', ref: 'kakaot', group: 'App 與網路' }])

  // 勾選會存進行程（兩個人看到同一份）
  const papago = page.getByRole('checkbox', { name: 'Papago 翻譯' })
  await papago.click()
  await expect(papago).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => sent.length).toBe(2)
  expect(sent[1]).toEqual([{ op: 'check_checklist_item', ref: 'papago', group: 'App 與網路', done: true }])

  // 改文字：勾選狀態留著
  await page.getByRole('button', { name: '編輯「Papago 翻譯」' }).click()
  const input = page.getByRole('textbox', { name: '修改「Papago 翻譯」' })
  await input.fill('Papago 翻譯（下載離線韓文包）')
  await page.getByRole('button', { name: '儲存' }).click()
  const renamed = page.getByRole('checkbox', { name: 'Papago 翻譯（下載離線韓文包）' })
  await expect(renamed).toHaveAttribute('aria-checked', 'true')
  expect(sent[2]).toEqual([{ op: 'update_checklist_item', ref: 'papago', group: 'App 與網路', label: 'Papago 翻譯（下載離線韓文包）' }])
  await page.screenshot({ path: 'e2e/screenshots/list.png' })
})

test('勾選存在行程裡：另一支手機重新整理也看得到；以前只存在手機上的勾選會搬過去', async ({ browser, baseURL }) => {
  let current = seoul2026
  let version = 40
  const serve = async (page: import('@playwright/test').Page) => {
    await page.route(`${API}/api/trips`, (r) => r.fulfill({ json: { trips: [{ version, trip: current, log: [] }] } }))
    await page.route(`${API}/api/trips/seoul-2026-11/apply`, (r) => {
      const result = applyOps(current, (r.request().postDataJSON() as { ops: Op[] }).ops)
      current = result.trip
      version += 1
      return r.fulfill({ json: { version, trip: current, changes: result.changes, log: [] } })
    })
  }
  // 她的手機：舊版在手機上勾過 Papago
  const hers = await (await browser.newContext({ baseURL })).newPage()
  await hers.addInitScript(() => {
    localStorage.setItem('trip-chat', JSON.stringify({ state: { passcode: 'x', threads: {} }, version: 1 }))
    if (!localStorage.getItem('trip-prefs'))
      localStorage.setItem('trip-prefs', JSON.stringify({ state: { viewer: {}, checked: { 'seoul-2026-11': ['papago'] }, seen: {}, collapsed: [] }, version: 1 }))
  })
  await serve(hers)
  await hers.goto('./#/trip/seoul-2026-11/list')
  await expect(hers.getByRole('checkbox', { name: 'Papago 翻譯' })).toHaveAttribute('aria-checked', 'true')
  await hers.getByRole('checkbox', { name: 'Kakao T 註冊、綁卡' }).click()
  await expect.poll(() => current.checklist.flatMap((g) => g.items).filter((i) => i.done).map((i) => i.id).sort()).toEqual(['kakaot', 'papago'])

  // 我的手機：沒勾過，打開就看到她勾的
  const mine = await (await browser.newContext({ baseURL })).newPage()
  await serve(mine)
  await mine.goto('./#/trip/seoul-2026-11/list')
  await expect(mine.getByRole('checkbox', { name: 'Papago 翻譯' })).toHaveAttribute('aria-checked', 'true')
  await expect(mine.getByRole('checkbox', { name: 'Kakao T 註冊、綁卡' })).toHaveAttribute('aria-checked', 'true')
  // 沒輸入通關密語時不能勾，會提示
  await mine.getByRole('checkbox', { name: 'Papago 翻譯' }).click()
  await expect(mine.getByText('要先在小樹那邊輸入通關密語')).toBeVisible()
  await expect(mine.getByRole('checkbox', { name: 'Papago 翻譯' })).toHaveAttribute('aria-checked', 'true')
})
