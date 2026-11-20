import { expect, test, testUser } from './fixtures'

// 帳號：登入畫面、邀請連結、裝置管理、登出。passkey 本身的流程另外在 auth.spec.ts 用真的後端跑
test('登入過期：回到登入畫面，看不到行程', async ({ page }) => {
  await page.route('**/api/me', (r) => r.fulfill({ status: 401, json: { error: '請先登入' } }))
  await page.route('**/api/trips', (r) => r.fulfill({ status: 401, json: { error: '請先登入' } }))
  await page.goto('./#/trip/seoul-2026-11')
  await expect(page.getByRole('button', { name: '用 Face ID／指紋登入' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '落地直奔場館' })).toHaveCount(0)
})

test('打開邀請連結：顯示邀請誰，按鈕是建立 passkey', async ({ page }) => {
  await page.route('**/api/me', (r) => r.fulfill({ status: 401, json: { error: '請先登入' } }))
  let asked = ''
  await page.route('**/api/auth/invite/info', (r) => {
    asked = (r.request().postDataJSON() as { code: string }).code
    return r.fulfill({ json: { name: '她', newDevice: false } })
  })
  await page.goto('./#/join/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG')
  await expect(page.getByText('歡迎，她')).toBeVisible()
  await expect(page.getByRole('button', { name: '建立 passkey' })).toBeVisible()
  expect(asked).toBe('abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG')
})

test('用過的邀請連結：說明要再產生一個', async ({ page }) => {
  await page.route('**/api/me', (r) => r.fulfill({ status: 401, json: { error: '請先登入' } }))
  await page.route('**/api/auth/invite/info', (r) => r.fulfill({ status: 410, json: { error: '邀請連結已經用過或過期了，請再產生一個' } }))
  await page.goto('./#/join/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG')
  await expect(page.getByText('邀請連結已經用過或過期了，請再產生一個')).toBeVisible()
  await expect(page.getByRole('button', { name: '建立 passkey' })).toHaveCount(0)
})

test('帳號：列出裝置、產生新裝置與新旅伴的邀請連結、移除裝置要再確認', async ({ page }) => {
  const invites: unknown[] = []
  await page.route('**/api/auth/invites', (r) => {
    invites.push(r.request().postDataJSON())
    return r.fulfill({ json: { code: `code-${invites.length}-abcdefghijklmnopqrstuvwxyz`, expiresAt: '2026-11-22T00:00:00Z' } })
  })
  const removed: unknown[] = []
  await page.route('**/api/auth/credentials/remove', (r) => {
    removed.push(r.request().postDataJSON())
    return r.fulfill({ json: { ok: true } })
  })
  await page.goto('./#/')
  await page.getByRole('button', { name: '帳號' }).click()
  const sheet = page.getByRole('dialog', { name: '帳號' })
  await expect(sheet.getByText('目前登入：我')).toBeVisible()
  await expect(sheet.getByText('iPhone')).toBeVisible()
  await expect(sheet.getByText('Mac')).toBeVisible()

  await sheet.getByRole('button', { name: '加一台我自己的新裝置' }).click()
  await expect(sheet.getByText(/#\/join\/code-1-/)).toBeVisible()
  await expect(sheet.getByText('24 小時內有效，用一次就失效。只傳給要加入的人。')).toBeVisible()
  expect(invites[0]).toEqual({})
  await sheet.getByRole('button', { name: '完成' }).click()

  await sheet.getByRole('button', { name: '邀請新旅伴' }).click()
  await sheet.getByRole('textbox', { name: '新旅伴的名字' }).fill('小美')
  await sheet.getByRole('button', { name: '產生連結' }).click()
  await expect(sheet.getByText(/#\/join\/code-2-/)).toBeVisible()
  expect(invites[1]).toEqual({ name: '小美' })

  await sheet.getByRole('button', { name: '移除「Mac」' }).click()
  expect(removed).toHaveLength(0)
  await expect(sheet.getByText('移除後，這台裝置會立刻被登出')).toBeVisible()
  await page.route('**/api/me', (r) => r.fulfill({ json: { user: { ...testUser, credentials: testUser.credentials.slice(0, 1) } } }))
  await sheet.getByRole('button', { name: '移除', exact: true }).click()
  await expect(sheet.getByText('Mac')).toHaveCount(0)
  expect(removed).toEqual([{ id: 'cred-mac' }])
  // 只剩一台時沒有移除按鈕
  await expect(sheet.getByRole('button', { name: /移除「/ })).toHaveCount(0)
})

test('登出：清掉這支手機上存的行程與對話，回到登入畫面', async ({ page }) => {
  await page.route('**/api/auth/logout', (r) => r.fulfill({ json: { ok: true } }))
  await page.goto('./#/')
  await expect(page.getByRole('heading', { name: '首爾' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('trip-cache-v1'))).toContain('seoul-2026-11')
  await page.route('**/api/me', (r) => r.fulfill({ status: 401, json: { error: '請先登入' } }))
  await page.getByRole('button', { name: '帳號' }).click()
  await page.getByRole('button', { name: '登出這台裝置' }).click()
  await expect(page.getByRole('button', { name: '用 Face ID／指紋登入' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('trip-cache-v1'))).toBeNull()
})

test('行程動態顯示是誰改的', async ({ page }) => {
  const { seoul2026 } = await import('../test/fixtures/seoul-2026-11')
  const log = [
    { version: 2, at: new Date().toISOString(), source: 'manual', summary: '勾掉：護照', changes: [], by: '她' },
    { version: 1, at: '2026-11-01T00:00:00Z', source: 'sync', summary: '建立行程', changes: [] },
  ]
  await page.addInitScript(() =>
    localStorage.setItem('trip-prefs', JSON.stringify({ state: { viewer: {}, checked: {}, seen: { 'seoul-2026-11': 1 }, collapsed: [] }, version: 1 })),
  )
  await page.route('**/api/trips', (r) => r.fulfill({ json: { trips: [{ version: 2, trip: seoul2026, log }] } }))
  await page.goto('./#/trip/seoul-2026-11')
  await page.getByRole('button', { name: /行程動態/ }).click()
  const entry = page.getByRole('dialog', { name: '行程動態' }).getByRole('listitem').filter({ hasText: '勾掉：護照' })
  await expect(entry.getByText('她', { exact: true })).toBeVisible()
})
