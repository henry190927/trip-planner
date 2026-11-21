import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { AUTH_PORT, AUTH_STATE } from '../playwright.auth.config'
import { seoul2026 } from '../test/fixtures/seoul-2026-11'

const site = `http://localhost:${AUTH_PORT}`

/** 直接寫進本機 KV（模擬 scripts/invite.ts 與 scripts/push-trip.ts 做的事） */
function kvPut(key: string, value: unknown) {
  const file = `${AUTH_STATE}-value.json`
  writeFileSync(file, JSON.stringify(value))
  execFileSync('npx', ['wrangler', 'kv', 'key', 'put', key, '--path', file, '--binding', 'TRIPS', '--local', '--persist-to', AUTH_STATE], {
    stdio: 'ignore',
  })
}

function seedInvite() {
  const code = `test-invite-${Date.now()}-abcdefghijklmnopqrstuvwxyz`
  kvPut(`invite:${createHash('sha256').update(code).digest('hex')}`, { createdAt: new Date().toISOString() })
  return code
}

/** Chrome 的虛擬 passkey 裝置：當成有 Face ID、使用者一律通過驗證 */
async function addAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })
}

test.beforeAll(() => {
  const v1 = { version: 1, updatedAt: new Date().toISOString(), summary: '建立行程', trip: seoul2026, log: [] }
  kvPut('trip:seoul-2026-11', v1)
  kvPut('trips', ['seoul-2026-11'])
})

test('沒登入時 API 什麼都拿不到', async ({ request }) => {
  expect((await request.get(`${site}/api/trips`)).status()).toBe(401)
  expect((await request.get(`${site}/api/me`)).status()).toBe(401)
  const apply = await request.post(`${site}/api/trips/seoul-2026-11/apply`, { headers: { origin: site }, data: { ops: [] } })
  expect(apply.status()).toBe(401)
})

test('邀請連結 → 建立 passkey → 看得到行程；登出後用 passkey 再登入；邀請連結用一次就失效', async ({ page, context }) => {
  await addAuthenticator(page)
  const code = seedInvite()
  await page.goto(`/#/join/${code}`)
  await expect(page.getByText('歡迎加入')).toBeVisible()
  await page.getByRole('textbox', { name: '你的名字' }).fill('小美')
  await page.getByRole('button', { name: '建立 passkey' }).click()
  await expect(page.getByRole('heading', { name: '首爾' })).toBeVisible()
  expect(((await (await page.request.get(`${site}/api/me`)).json()) as { user: { name: string } }).user.name).toBe('小美')

  // 登入狀態在 JavaScript 讀不到的 cookie 裡
  const cookie = (await context.cookies()).find((c) => c.name === '__Host-sid')
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' })
  expect(await page.evaluate(() => document.cookie)).not.toContain('__Host-sid')

  // 同一個邀請連結不能再用
  const again = await page.request.post(`${site}/api/auth/invite/info`, { headers: { origin: site }, data: { code } })
  expect(again.status()).toBe(410)

  // 登出 → 登入畫面 → 用 passkey 登入
  await page.getByRole('button', { name: '帳號' }).click()
  await page.getByRole('button', { name: '登出這台裝置' }).click()
  await expect(page.getByRole('button', { name: '用 Face ID／指紋登入' })).toBeVisible()
  expect((await page.request.get(`${site}/api/trips`)).status()).toBe(401)
  await page.getByRole('button', { name: '用 Face ID／指紋登入' }).click()
  await expect(page.getByRole('heading', { name: '首爾' })).toBeVisible()

  // 改行程會記下是誰改的
  await page.getByRole('link', { name: /首爾/ }).click()
  await page.getByRole('link', { name: '清單', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Papago 翻譯' }).click()
  await expect(page.getByRole('checkbox', { name: 'Papago 翻譯' })).toHaveAttribute('aria-checked', 'true')
  const trips = (await (await page.request.get(`${site}/api/trips`)).json()) as { trips: { log: { by?: string; summary: string }[] }[] }
  await expect.poll(async () => ((await (await page.request.get(`${site}/api/trips`)).json()) as typeof trips).trips[0].log[0]).toMatchObject({ by: '小美' })
})

test('從別的網站送來的修改請求一律擋掉', async ({ request }) => {
  const res = await request.post(`${site}/api/auth/login/options`, { headers: { origin: 'https://evil.example' } })
  expect(res.status()).toBe(403)
  const noOrigin = await request.post(`${site}/api/auth/login/options`)
  expect(noOrigin.status()).toBe(403)
})

test('網頁帶著安全標頭', async ({ request }) => {
  const res = await request.get(`${site}/`)
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(res.headers()['x-content-type-options']).toBe('nosniff')
})
