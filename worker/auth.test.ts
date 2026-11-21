import { describe, expect, it } from 'vitest'
import type { Env } from './env'
import {
  AuthError,
  SESSION_COOKIE,
  cleanName,
  createInvite,
  currentUser,
  deviceLabel,
  inviteInfo,
  loginVerify,
  registerOptions,
  removeCredential,
  renameUser,
  sameOrigin,
  sha256,
  type User,
} from './auth'

function fakeEnv() {
  const kv = new Map<string, string>()
  const TRIPS = {
    get: async (k: string) => (kv.has(k) ? JSON.parse(kv.get(k)!) : null),
    put: async (k: string, v: string) => void kv.set(k, v),
    delete: async (k: string) => void kv.delete(k),
  }
  return { env: { TRIPS } as unknown as Env, kv }
}

const now = () => Math.floor(Date.now() / 1000)
const site = 'https://trip.example.workers.dev'

/** 直接在 KV 裡放一個帳號與登入狀態（passkey 本身的驗證由瀏覽器端的 e2e 測） */
async function signedIn(env: Env, { expiresIn = 20 * 24 * 3600, credentials = ['cred-a', 'cred-b'] } = {}) {
  const user: User = {
    id: 'u1',
    name: '她',
    createdAt: '2026-11-21T00:00:00Z',
    credentials: credentials.map((id) => ({ id, label: 'iPhone', createdAt: '2026-11-21T00:00:00Z' })),
    sessions: [],
  }
  const token = 'token-for-test-0123456789'
  const hash = await sha256(token)
  const expiresAt = now() + expiresIn
  user.sessions.push({ hash, credentialId: credentials[0], expiresAt })
  await env.TRIPS.put(`user:${user.id}`, JSON.stringify(user))
  await env.TRIPS.put(`sess:${hash}`, JSON.stringify({ userId: user.id, credentialId: credentials[0], expiresAt }))
  for (const id of credentials) await env.TRIPS.put(`cred:${id}`, JSON.stringify({ id, userId: user.id, publicKey: '', counter: 0 }))
  const req = new Request(`${site}/api/me`, { headers: { cookie: `other=1; ${SESSION_COOKIE}=${token}` } })
  return { user, req, hash }
}

describe('登入狀態', () => {
  it('沒有 cookie、或 cookie 不對，就是沒登入', async () => {
    const { env } = fakeEnv()
    expect(await currentUser(new Request(`${site}/api/me`), env)).toBeUndefined()
    await signedIn(env)
    const wrong = new Request(`${site}/api/me`, { headers: { cookie: `${SESSION_COOKIE}=not-the-token` } })
    expect(await currentUser(wrong, env)).toBeUndefined()
  })

  it('有效的登入狀態認得出是誰；還很久才過期就不重發 cookie', async () => {
    const { env } = fakeEnv()
    const { req } = await signedIn(env)
    const session = await currentUser(req, env)
    expect(session?.user.name).toBe('她')
    expect(session?.setCookie).toBeUndefined()
  })

  it('快過期時自動延長，並給新的 cookie（HttpOnly、只限這個網站）', async () => {
    const { env } = fakeEnv()
    const { req } = await signedIn(env, { expiresIn: 3 * 24 * 3600 })
    const session = await currentUser(req, env)
    expect(session?.setCookie).toMatch(/^__Host-sid=token-for-test-0123456789; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000$/)
  })

  it('過期了就不算登入', async () => {
    const { env } = fakeEnv()
    const { req } = await signedIn(env, { expiresIn: -10 })
    expect(await currentUser(req, env)).toBeUndefined()
  })
})

describe('刪掉裝置', () => {
  it('刪掉一把 passkey，用它登入的狀態立刻失效', async () => {
    const { env, kv } = fakeEnv()
    const { user, req, hash } = await signedIn(env)
    await removeCredential(env, user, 'cred-a')
    expect(kv.has('cred:cred-a')).toBe(false)
    expect(kv.has(`sess:${hash}`)).toBe(false)
    expect(await currentUser(req, env)).toBeUndefined()
    const saved = JSON.parse(kv.get('user:u1')!) as User
    expect(saved.credentials.map((c) => c.id)).toEqual(['cred-b'])
  })

  it('最後一把不能刪，免得自己登不進來', async () => {
    const { env } = fakeEnv()
    const { user } = await signedIn(env, { credentials: ['only'] })
    await expect(removeCredential(env, user, 'only')).rejects.toThrow('唯一的裝置')
  })

  it('不是自己的 passkey 刪不掉', async () => {
    const { env } = fakeEnv()
    const { user } = await signedIn(env)
    await expect(removeCredential(env, user, 'someone-else')).rejects.toBeInstanceOf(AuthError)
  })
})

describe('邀請連結', () => {
  it('KV 只存雜湊；邀請新旅伴不預先指定名字；亂打或過期的連結不能用', async () => {
    const { env, kv } = fakeEnv()
    const { code } = await createInvite(env, { createdAt: '2026-11-21T00:00:00Z' })
    expect(code.length).toBeGreaterThanOrEqual(40)
    expect([...kv.keys()].some((k) => k.includes(code))).toBe(false)
    expect(await inviteInfo(env, code)).toEqual({ newDevice: false })
    const device = await createInvite(env, { userId: 'u1', name: '小明', createdAt: '2026-11-21T00:00:00Z' })
    expect(await inviteInfo(env, device.code)).toEqual({ name: '小明', newDevice: true })
    await expect(inviteInfo(env, 'x'.repeat(43))).rejects.toMatchObject({ status: 410 })
    await expect(inviteInfo(env, 'short')).rejects.toMatchObject({ status: 400 })
  })

  it('建立 passkey 的選項：新旅伴自己填名字；要求裝置驗證（Face ID／指紋）、存在裝置上、綁這個網域', async () => {
    const { env } = fakeEnv()
    const { code } = await createInvite(env, { createdAt: '2026-11-21T00:00:00Z' })
    const req = new Request(`${site}/api/auth/invite/options`)
    await expect(registerOptions(req, env, code)).rejects.toMatchObject({ status: 400, message: '請輸入名字' })
    await expect(registerOptions(req, env, code, '   ')).rejects.toMatchObject({ status: 400 })
    const { options, challengeId } = await registerOptions(req, env, code, '  小美 ')
    expect(options.user).toMatchObject({ name: '小美', displayName: '小美' })
    expect(options.rp).toEqual({ name: '旅行手帖', id: 'trip.example.workers.dev' })
    expect(options.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' })
    expect(challengeId.length).toBeGreaterThan(20)
  })
})

describe('名字', () => {
  it('去掉前後空白與控制字元，最多 20 個字', () => {
    expect(cleanName('  小美\n ')).toBe('小美')
    expect(cleanName('一'.repeat(20))).toBe('一'.repeat(20))
    expect(() => cleanName('一'.repeat(21))).toThrow('最多 20 個字')
    expect(() => cleanName(42)).toThrow('請輸入名字')
  })

  it('改名字只改自己的帳號', async () => {
    const { env, kv } = fakeEnv()
    const { user } = await signedIn(env)
    const next = await renameUser(env, user, '小美')
    expect(next.name).toBe('小美')
    expect((JSON.parse(kv.get('user:u1')!) as User).name).toBe('小美')
  })
})

describe('登入流程的防護', () => {
  it('挑戰只能用一次，沒有的挑戰直接拒絕', async () => {
    const { env } = fakeEnv()
    const req = new Request(`${site}/api/auth/login/verify`)
    await expect(loginVerify(req, env, { challengeId: 'no-such-challenge-000000', response: undefined })).rejects.toMatchObject({ status: 400 })
  })

  it('只接受網站本身送來的修改請求', () => {
    expect(sameOrigin(new Request(`${site}/api/chat`, { method: 'POST', headers: { origin: site } }))).toBe(true)
    expect(sameOrigin(new Request(`${site}/api/chat`, { method: 'POST', headers: { origin: 'https://evil.example' } }))).toBe(false)
    expect(sameOrigin(new Request(`${site}/api/chat`, { method: 'POST' }))).toBe(false)
  })

  it('裝置名稱', () => {
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('iPhone')
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 15; SM-S928B)')).toBe('Android 手機')
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mac')
  })
})
