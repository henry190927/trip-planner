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

  // 其他項目照常可以勾
  const papago = page.getByRole('checkbox', { name: 'Papago 翻譯' })
  await papago.click()
  await expect(papago).toHaveAttribute('aria-checked', 'true')

  // 改文字：勾選狀態留著
  await page.getByRole('button', { name: '編輯「Papago 翻譯」' }).click()
  const input = page.getByRole('textbox', { name: '修改「Papago 翻譯」' })
  await input.fill('Papago 翻譯（下載離線韓文包）')
  await page.getByRole('button', { name: '儲存' }).click()
  const renamed = page.getByRole('checkbox', { name: 'Papago 翻譯（下載離線韓文包）' })
  await expect(renamed).toHaveAttribute('aria-checked', 'true')
  expect(sent[1]).toEqual([{ op: 'update_checklist_item', ref: 'papago', group: 'App 與網路', label: 'Papago 翻譯（下載離線韓文包）' }])
  await page.screenshot({ path: 'e2e/screenshots/list.png' })
})
