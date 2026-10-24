import { expect, test } from '@playwright/test'

const trip = '#/trip/seoul-2026-11'

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
  await expect(page.getByText('取票・簡單吃晚餐')).toBeVisible()
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

test('清單勾選重新整理後還在', async ({ page }) => {
  await page.goto(`./${trip}/list`)
  const box = page.getByRole('checkbox', { name: /護照/ })
  await box.click()
  await expect(box).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /護照/ })).toHaveAttribute('aria-checked', 'true')
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
