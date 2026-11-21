import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import type { Env } from './env'

// 登入：每個人用 passkey（Face ID／指紋／裝置密碼）登入，沒有密碼。
// 第一次使用或換新裝置時，要有一次性的邀請連結（已登入的人在 App 裡產生，或用 scripts/invite.ts）。
//
// KV 版面：
//   user:<id>          { id, name, createdAt, credentials: [...], sessions: [...] }
//   cred:<credId>      這把 passkey 的公鑰與計數器
//   sess:<sha256>      登入狀態（cookie 裡放的是原始 token，KV 只存雜湊）
//   invite:<sha256>    邀請連結（24 小時、用一次就失效）
//   chal:<id>          登入或建立 passkey 時的一次性挑戰（5 分鐘）

export const SESSION_COOKIE = '__Host-sid'
const SESSION_SECONDS = 30 * 24 * 3600
/** 剩不到這麼多天就自動延長，常用的人就不會被登出 */
const RENEW_SECONDS = 15 * 24 * 3600
const INVITE_SECONDS = 24 * 3600
const CHALLENGE_SECONDS = 300
const MAX_SESSIONS = 20

export interface CredentialInfo {
  id: string
  /** 例如「iPhone」，讓人分得出是哪一台 */
  label: string
  createdAt: string
  lastUsedAt?: string
}

interface SessionRef {
  hash: string
  credentialId: string
  expiresAt: number
}

export interface User {
  id: string
  name: string
  createdAt: string
  credentials: CredentialInfo[]
  sessions: SessionRef[]
}

interface StoredCredential {
  id: string
  userId: string
  publicKey: string
  counter: number
  transports?: string[]
}

interface Session {
  userId: string
  credentialId: string
  expiresAt: number
}

export interface Invite {
  /** 有值：替這個人加一台新裝置；沒有：邀請一位新旅伴（名字由對方加入時自己填） */
  userId?: string
  /** 加新裝置時是那個人的名字；邀請新旅伴時是建議的名字（可以不給） */
  name?: string
  createdAt: string
}

interface Challenge {
  challenge: string
  kind: 'login' | 'register'
  inviteHash?: string
  /** 建立 passkey 時寫進 passkey 的帳號 id，新帳號就用這個 */
  userId?: string
  /** 新帳號的名字 */
  name?: string
}

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const enc = new TextEncoder()

export function randomToken(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

const nowSeconds = () => Math.floor(Date.now() / 1000)

export const NAME_MAX = 20

/** 顯示名稱：去掉前後空白與控制字元，1～20 個字 */
export function cleanName(name: unknown) {
  const text = typeof name === 'string' ? [...name].filter((c) => c.charCodeAt(0) >= 32 && c !== '\u007f').join('').trim() : ''
  if (!text) throw new AuthError(400, '請輸入名字')
  if ([...text].length > NAME_MAX) throw new AuthError(400, `名字最多 ${NAME_MAX} 個字`)
  return text
}

/** passkey 綁定網站的網域；用請求本身的網址，開發（localhost）和正式網址都適用 */
export function relyingParty(req: Request) {
  const url = new URL(req.url)
  return { rpID: url.hostname, origin: url.origin }
}

/** 只接受從這個網站本身送來的修改請求（擋跨站偽造請求） */
export function sameOrigin(req: Request) {
  return req.headers.get('origin') === new URL(req.url).origin
}

export function deviceLabel(userAgent: string) {
  if (/iPhone/i.test(userAgent)) return 'iPhone'
  if (/iPad/i.test(userAgent)) return 'iPad'
  if (/Android/i.test(userAgent)) return 'Android 手機'
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'Mac'
  if (/Windows/i.test(userAgent)) return 'Windows 電腦'
  return '其他裝置'
}

const getJson = <T>(env: Env, key: string) => env.TRIPS.get<T>(key, 'json')
const putJson = (env: Env, key: string, value: unknown, ttl?: number) =>
  env.TRIPS.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined)

export const getUser = (env: Env, id: string) => getJson<User>(env, `user:${id}`)
const saveUser = (env: Env, user: User) => putJson(env, `user:${user.id}`, user)

function cookieValue(req: Request, name: string) {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return undefined
}

export const sessionCookie = (token: string, maxAge = SESSION_SECONDS) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`

/** 目前登入的人；沒登入或過期回傳 undefined。快過期時順便延長，並給新的 cookie */
export async function currentUser(req: Request, env: Env): Promise<{ user: User; setCookie?: string } | undefined> {
  const token = cookieValue(req, SESSION_COOKIE)
  if (!token) return undefined
  const hash = await sha256(token)
  const session = await getJson<Session>(env, `sess:${hash}`)
  if (!session || session.expiresAt <= nowSeconds()) return undefined
  const user = await getUser(env, session.userId)
  // passkey 被刪掉（例如手機遺失）之後，用它登入的狀態也一起失效
  if (!user || !user.credentials.some((c) => c.id === session.credentialId)) return undefined
  if (session.expiresAt - nowSeconds() > RENEW_SECONDS) return { user }
  const expiresAt = nowSeconds() + SESSION_SECONDS
  await putJson(env, `sess:${hash}`, { ...session, expiresAt }, SESSION_SECONDS)
  user.sessions = user.sessions.map((s) => (s.hash === hash ? { ...s, expiresAt } : s))
  await saveUser(env, user)
  return { user, setCookie: sessionCookie(token) }
}

async function startSession(env: Env, user: User, credentialId: string) {
  const token = randomToken()
  const hash = await sha256(token)
  const expiresAt = nowSeconds() + SESSION_SECONDS
  await putJson(env, `sess:${hash}`, { userId: user.id, credentialId, expiresAt } satisfies Session, SESSION_SECONDS)
  const live = user.sessions.filter((s) => s.expiresAt > nowSeconds())
  user.sessions = [...live, { hash, credentialId, expiresAt }].slice(-MAX_SESSIONS)
  await saveUser(env, user)
  return sessionCookie(token)
}

export async function endSession(req: Request, env: Env) {
  const token = cookieValue(req, SESSION_COOKIE)
  if (!token) return
  const hash = await sha256(token)
  const session = await getJson<Session>(env, `sess:${hash}`)
  await env.TRIPS.delete(`sess:${hash}`)
  if (!session) return
  const user = await getUser(env, session.userId)
  if (user) await saveUser(env, { ...user, sessions: user.sessions.filter((s) => s.hash !== hash) })
}

async function takeChallenge(env: Env, id: unknown, kind: Challenge['kind']) {
  if (typeof id !== 'string' || !/^[\w-]{20,}$/.test(id)) throw new AuthError(400, '登入流程逾時，請再試一次')
  const challenge = await getJson<Challenge>(env, `chal:${id}`)
  // 一次性：用過就刪，重送同一份回應不會通過
  await env.TRIPS.delete(`chal:${id}`)
  if (!challenge || challenge.kind !== kind) throw new AuthError(400, '登入流程逾時，請再試一次')
  return challenge
}

async function saveChallenge(env: Env, challenge: Challenge) {
  const id = randomToken(18)
  await putJson(env, `chal:${id}`, challenge, CHALLENGE_SECONDS)
  return id
}

// ---- 登入 ----

export async function loginOptions(req: Request, env: Env) {
  const { rpID } = relyingParty(req)
  // 不指定帳號：手機會列出這個網站存過的 passkey，直接用 Face ID 選
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' })
  const challengeId = await saveChallenge(env, { challenge: options.challenge, kind: 'login' })
  return { options, challengeId }
}

export async function loginVerify(req: Request, env: Env, body: { challengeId?: unknown; response?: AuthenticationResponseJSON }) {
  const { challenge } = await takeChallenge(env, body.challengeId, 'login')
  const response = body.response
  if (!response || typeof response.id !== 'string') throw new AuthError(400, '登入資料不完整')
  const stored = await getJson<StoredCredential>(env, `cred:${response.id}`)
  if (!stored) throw new AuthError(401, '這把 passkey 已經失效，請請旅伴產生邀請連結重新加入')
  const user = await getUser(env, stored.userId)
  if (!user || !user.credentials.some((c) => c.id === stored.id)) throw new AuthError(401, '這把 passkey 已經失效')
  const { rpID, origin } = relyingParty(req)
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: { id: stored.id, publicKey: fromB64(stored.publicKey), counter: stored.counter, transports: stored.transports },
  }).catch(() => ({ verified: false as const, authenticationInfo: undefined }))
  if (!result.verified || !result.authenticationInfo) throw new AuthError(401, '登入驗證沒有通過')
  await putJson(env, `cred:${stored.id}`, { ...stored, counter: result.authenticationInfo.newCounter })
  user.credentials = user.credentials.map((c) => (c.id === stored.id ? { ...c, lastUsedAt: new Date().toISOString() } : c))
  const setCookie = await startSession(env, user, stored.id)
  return { user, setCookie }
}

// ---- 邀請與建立 passkey ----

export async function createInvite(env: Env, invite: Invite) {
  const code = randomToken()
  await putJson(env, `invite:${await sha256(code)}`, invite, INVITE_SECONDS)
  return { code, expiresAt: new Date(Date.now() + INVITE_SECONDS * 1000).toISOString() }
}

async function readInvite(env: Env, code: unknown) {
  if (typeof code !== 'string' || !/^[\w-]{20,}$/.test(code)) throw new AuthError(400, '邀請連結不完整')
  const hash = await sha256(code)
  const invite = await getJson<Invite>(env, `invite:${hash}`)
  if (!invite) throw new AuthError(410, '邀請連結已經用過或過期了，請再產生一個')
  return { invite, hash }
}

export async function inviteInfo(env: Env, code: unknown) {
  const { invite } = await readInvite(env, code)
  return { ...(invite.name && { name: invite.name }), newDevice: !!invite.userId }
}

/** 建立 passkey 的選項。新旅伴要帶自己填的名字；加新裝置沿用帳號原本的名字 */
export async function registerOptions(req: Request, env: Env, code: unknown, name?: unknown) {
  const { invite, hash } = await readInvite(env, code)
  const user = invite.userId ? await getUser(env, invite.userId) : undefined
  if (invite.userId && !user) throw new AuthError(410, '這個帳號已經不存在')
  const displayName = user ? user.name : cleanName(name)
  const { rpID } = relyingParty(req)
  const userId = user?.id ?? randomToken(12)
  const options = await generateRegistrationOptions({
    rpName: '旅行手帖',
    rpID,
    userName: displayName,
    userDisplayName: displayName,
    userID: new Uint8Array(enc.encode(userId)),
    attestationType: 'none',
    // 同一台裝置不要重複建立
    excludeCredentials: (user?.credentials ?? []).map((c) => ({ id: c.id })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  })
  const challengeId = await saveChallenge(env, { challenge: options.challenge, kind: 'register', inviteHash: hash, userId, name: displayName })
  return { options, challengeId }
}

export async function registerVerify(
  req: Request,
  env: Env,
  body: { code?: unknown; challengeId?: unknown; response?: RegistrationResponseJSON },
) {
  const { invite, hash } = await readInvite(env, body.code)
  const challenge = await takeChallenge(env, body.challengeId, 'register')
  if (challenge.inviteHash !== hash) throw new AuthError(400, '邀請連結和登入流程對不起來，請再試一次')
  if (!body.response) throw new AuthError(400, '資料不完整')
  const { rpID, origin } = relyingParty(req)
  const result = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  }).catch(() => ({ verified: false as const, registrationInfo: undefined }))
  if (!result.verified || !result.registrationInfo) throw new AuthError(400, '建立 passkey 沒有成功')
  const { credential } = result.registrationInfo

  const now = new Date().toISOString()
  const existing = invite.userId ? await getUser(env, invite.userId) : undefined
  if (invite.userId && !existing) throw new AuthError(410, '這個帳號已經不存在')
  const user: User = existing ?? {
    id: challenge.userId ?? randomToken(12),
    name: cleanName(challenge.name),
    createdAt: now,
    credentials: [],
    sessions: [],
  }
  if (user.credentials.some((c) => c.id === credential.id)) throw new AuthError(409, '這台裝置已經加入過了')
  // 邀請用一次就失效
  await env.TRIPS.delete(`invite:${hash}`)
  await putJson(env, `cred:${credential.id}`, {
    id: credential.id,
    userId: user.id,
    publicKey: toB64(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
  } satisfies StoredCredential)
  user.credentials = [...user.credentials, { id: credential.id, label: deviceLabel(req.headers.get('user-agent') ?? ''), createdAt: now, lastUsedAt: now }]
  const setCookie = await startSession(env, user, credential.id)
  return { user, setCookie }
}

// ---- 已登入的人管理自己的裝置 ----

/** 刪掉一把 passkey（例如手機遺失）：用它登入的狀態立刻失效。最後一把不能刪，免得自己再也登不進來 */
export async function removeCredential(env: Env, user: User, credentialId: unknown) {
  if (!user.credentials.some((c) => c.id === credentialId)) throw new AuthError(404, '找不到這台裝置')
  if (user.credentials.length <= 1) throw new AuthError(409, '這是你唯一的裝置，刪掉就登不進來了')
  const dropped = user.sessions.filter((s) => s.credentialId === credentialId)
  await Promise.all([env.TRIPS.delete(`cred:${credentialId}`), ...dropped.map((s) => env.TRIPS.delete(`sess:${s.hash}`))])
  await saveUser(env, {
    ...user,
    credentials: user.credentials.filter((c) => c.id !== credentialId),
    sessions: user.sessions.filter((s) => s.credentialId !== credentialId),
  })
}

export async function renameUser(env: Env, user: User, name: unknown) {
  const next = { ...user, name: cleanName(name) }
  await saveUser(env, next)
  return next
}

/** 給網站看的帳號資料（不含 session 雜湊） */
export const publicUser = (user: User) => ({ id: user.id, name: user.name, credentials: user.credentials })
