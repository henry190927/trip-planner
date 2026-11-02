import { expect, test } from '@playwright/test'
import { seoul2026 } from '../src/trips/seoul-2026-11'

const trip = '#/trip/seoul-2026-11'

// 不連線上的後端：測試結果不能跟著線上資料變，一律回傳網站內建的行程
test.beforeEach(async ({ page }) => {
  await page.route('**/api/trips', (r) => r.fulfill({ json: { trips: [{ version: 0, trip: seoul2026, log: [] }] } }))
})

test('首頁顯示旅程卡', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: '首爾' })).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/home.png', fullPage: true })
})

test('只看「她」的行程時，不會出現「我」的項目', async ({ page }) => {
  await page.goto(`./${trip}`)
  await expect(page.getByText('帶兩人的行李搭計程車')).toBeVisible()
  await page.getByRole('radio', { name: '她' }).click()
  await expect(page.getByText('帶兩人的行李搭計程車')).toHaveCount(0)
  await expect(page.getByText(/取票・吃晚餐/)).toBeVisible()
  await page.getByRole('radio', { name: '全部' }).click()
  await page.screenshot({ path: 'e2e/screenshots/plan.png', fullPage: true })
})

test('交通指南連結會捲到對應路線', async ({ page }) => {
  await page.goto(`./${trip}`)
  await page.getByRole('link', { name: '交通指南' }).first().click()
  await expect(page).toHaveURL(/routes\/icn-to-arena/)
  await expect(page.locator('#route-icn-to-arena')).toBeInViewport()
  await page.screenshot({ path: 'e2e/screenshots/routes.png', fullPage: true })
})

test('給司機看：全螢幕顯示韓文地址', async ({ page }) => {
  await page.goto(`./${trip}/info`)
  await page.getByRole('button', { name: '給司機看' }).first().click()
  await expect(page.getByRole('dialog').getByText('서교동 333-41')).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'e2e/screenshots/driver.png' })
  await page.getByRole('dialog').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.screenshot({ path: 'e2e/screenshots/info.png', fullPage: true })
})

test('清單：顯示行程裡已勾掉的項目', async ({ page }) => {
  const checked = structuredClone(seoul2026)
  checked.checklist[0].items[0].done = true
  await page.route('**/api/trips', (r) => r.fulfill({ json: { trips: [{ version: 1, trip: checked, log: [] }] } }))
  await page.goto(`./${trip}/list`)
  await expect(page.getByRole('checkbox', { name: checked.checklist[0].items[0].label })).toHaveAttribute('aria-checked', 'true')
  await page.screenshot({ path: 'e2e/screenshots/list.png', fullPage: true })
})

test('左右滑動切換天數', async ({ page }) => {
  await page.goto(`./${trip}`)
  const box = (await page.getByRole('heading', { name: '落地直奔場館' }).boundingBox())!
  await page.mouse.move(box.x + 200, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + 20, box.y + 200, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByRole('heading', { name: '逛街・第二場' })).toBeVisible()
})

// 回歸測試：離開「交通 / 資訊 / 清單」分頁時曾經整頁空白（effect 回傳了 scrollTo 的 Promise）。
// 當機發生在舊分頁退場動畫結束、真正卸載的時候，所以每次切換都要等動畫跑完再檢查。
test('用底部導覽列切遍所有分頁，畫面都不會消失', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`./${trip}`)
  for (const tab of ['交通', '地點', '資訊', '清單', '行程', '清單', '地點', '資訊', '交通', '行程']) {
    const link = page.getByRole('link', { name: tab, exact: true })
    await link.click()
    await expect(link).toHaveAttribute('aria-current', 'page')
    await page.waitForTimeout(500)
    await expect(page.getByText('畫面出了點問題')).toHaveCount(0)
    await expect(page.locator('main')).not.toBeEmpty()
  }
  await page.getByRole('link', { name: '回首頁' }).click()
  await expect(page.getByRole('heading', { name: '首爾' })).toBeVisible()
  expect(errors).toEqual([])
})
