import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { opsSchema } from '../src/schema'
import { applyOps } from '../src/lib/ops'
import { runAgent, type ChatEvent, type ChatImage, type ChatMessage } from './agent'
import {
  AuthError,
  createInvite,
  currentUser,
  endSession,
  inviteInfo,
  loginOptions,
  loginVerify,
  publicUser,
  registerOptions,
  registerVerify,
  removeCredential,
  renameUser,
  sameOrigin,
  sessionCookie,
  type User,
} from './auth'
import { imageError } from './images'
import type { Env } from './env'
import { GeminiError, modelStatus } from './gemini'
import { blankTrip, newTripId } from '../src/lib/sectionOps'
import { validateTrip } from '../src/lib/validate'
import { createTrip, loadTrip, saveTrip, tripIds, undo, type Stored } from './store'

export { GeminiRelay } from './relay-object'

// 網站和 API 由同一個 Worker 提供：/api/* 由這裡處理，其他路徑是 dist/ 的網頁檔（見 wrangler.jsonc 的 assets）。
// 除了登入相關的端點，全部都要先登入（passkey，見 auth.ts）。
//
//   GET  /api/me                          目前登入的人
//   POST /api/auth/login/options|verify   用 passkey 登入
//   POST /api/auth/invite/info|options|verify  用邀請連結建立 passkey（新旅伴或新裝置）
//   POST /api/auth/logout
//   POST /api/auth/invites                產生邀請連結：{ for: 'device' } 給自己的新裝置、{ for: 'person' } 邀請新旅伴
//   POST /api/auth/credentials/remove     刪掉一台裝置的 passkey
//   POST /api/auth/profile                改自己的名字
//   GET  /api/trips                       所有行程的最新版本
//   POST /api/trips                       建立新行程（小樹在空白草稿上提的修改）
//   GET  /api/models                      可以選的 AI 模型與目前能不能用
//   POST /api/chat                        和小樹聊天（SSE 串流）；model 指定先用哪個模型
//   POST /api/trips/:id/apply             套用修改
//   POST /api/trips/:id/undo              復原最新一次修改

/** 給網站的部分：parent 是後端內部用的 */
const published = (s: Stored) => ({ version: s.version, updatedAt: s.updatedAt, trip: s.trip, log: s.log ?? [] })

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })

const withCookie = (res: Response, cookie?: string) => {
  if (cookie) res.headers.append('set-cookie', cookie)
  return res
}

function geminiMessage(e: unknown) {
  if (e instanceof GeminiError) {
    if (e.status === 429)
      return /per day/i.test(e.message)
        ? 'AI 今天的免費額度用完了，台灣時間下午 3 點左右會重置。'
        : 'AI 的免費額度暫時用完了，過一分鐘再試試。'
    if (e.status === 503) return 'AI 那邊現在太多人在用，等一下再試試。'
    if (e.status === 401 || e.status === 403) return 'AI 金鑰有問題，請檢查 Worker 的 GEMINI_API_KEY 設定。'
    return `AI 服務出錯（${e.status}）：${e.message}`
  }
  return `出錯了：${e instanceof Error ? e.message : String(e)}`
}

/** 所有帳號的名字（新行程的旅伴預設就是大家） */
async function accountNames(env: Env) {
  const { keys } = await env.TRIPS.list({ prefix: 'user:' })
  const users = await Promise.all(keys.map((k) => env.TRIPS.get<{ name: string; createdAt: string }>(k.name, 'json')))
  return users
    .filter((u): u is { name: string; createdAt: string } => !!u)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((u) => u.name)
}

const todayInTaipei = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())

/** 新行程的空白草稿；聊天時和套用時各產生一次，所以只依賴帳號名字與日期 */
const draftTrip = async (env: Env): Promise<Stored> => ({
  version: 0,
  updatedAt: new Date().toISOString(),
  summary: '',
  trip: blankTrip(await accountNames(env), todayInTaipei()),
})

async function chat(req: Request, env: Env) {
  const body = (await req.json().catch(() => null)) as {
    tripId?: string
    newTrip?: boolean
    viewer?: string
    model?: string
    messages?: (ChatMessage & { images?: ChatImage[] })[]
  } | null
  const creating = body?.newTrip === true
  const stored = creating ? await draftTrip(env) : body?.tripId ? await loadTrip(env, body.tripId) : undefined
  if (!stored) return json({ error: '找不到這個行程' }, 404)
  const messages: ChatMessage[] = (body?.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }))
  if (messages.at(-1)?.role !== 'user') return json({ error: '最後一則要是使用者的訊息' }, 400)
  // 圖片只收最後一則的；之前附過的不重傳
  const raw = body?.messages?.at(-1)?.images
  const images = Array.isArray(raw) ? raw : []
  if (images.length) {
    const error = imageError(images)
    if (error) return json({ error }, 400)
    messages[messages.length - 1].images = images.map((i) => ({ mimeType: i.mimeType, data: i.data }))
  }

  const { readable, writable } = new TransformStream<Uint8Array>()
  const writer = writable.getWriter()
  const enc = new TextEncoder()
  const emit = (e: ChatEvent) => void writer.write(enc.encode(`data: ${JSON.stringify(e)}\n\n`))

  // 等模型的時候可能好幾十秒沒有資料；定時送心跳，連線才不會被當成閒置而切斷（SSE 註解行，網站會忽略）
  const heartbeat = setInterval(() => void writer.write(enc.encode(': ping\n\n')), 15_000)
  const work = (async () => {
    try {
      // 只認得行程裡的旅伴 id
      const viewer = stored.trip.travelers.some((t) => t.id === body?.viewer) ? body!.viewer : undefined
      await runAgent(env, stored, messages, emit, viewer, creating ? 'create' : 'edit', typeof body?.model === 'string' ? body.model : undefined)
    } catch (e) {
      console.error(e)
      emit({ type: 'error', text: geminiMessage(e) })
    }
    clearInterval(heartbeat)
    emit({ type: 'done' })
    await writer.close()
  })()

  return { response: new Response(readable, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' } }), work }
}

async function readBody<T>(req: Request) {
  return ((await req.json().catch(() => null)) ?? {}) as T
}

async function authRoutes(req: Request, env: Env, path: string): Promise<Response | undefined> {
  switch (path) {
    case '/api/auth/login/options':
      return json(await loginOptions(req, env))
    case '/api/auth/login/verify': {
      const body = await readBody<{ challengeId?: unknown; response?: AuthenticationResponseJSON }>(req)
      const { user, setCookie } = await loginVerify(req, env, body)
      return withCookie(json({ user: publicUser(user) }), setCookie)
    }
    case '/api/auth/invite/info':
      return json(await inviteInfo(env, (await readBody<{ code?: unknown }>(req)).code))
    case '/api/auth/invite/options': {
      const body = await readBody<{ code?: unknown; name?: unknown }>(req)
      return json(await registerOptions(req, env, body.code, body.name))
    }
    case '/api/auth/invite/verify': {
      const body = await readBody<{ code?: unknown; challengeId?: unknown; response?: RegistrationResponseJSON }>(req)
      const { user, setCookie } = await registerVerify(req, env, body)
      return withCookie(json({ user: publicUser(user) }), setCookie)
    }
    case '/api/auth/logout':
      await endSession(req, env)
      return withCookie(json({ ok: true }), sessionCookie('', 0))
  }
  return undefined
}

async function signedInRoutes(req: Request, env: Env, path: string, user: User, ctx: ExecutionContext): Promise<Response> {
  if (req.method === 'GET' && path === '/api/me') return json({ user: publicUser(user) })

  if (req.method === 'GET' && path === '/api/models') return json({ models: await modelStatus(env) })

  if (req.method === 'GET' && path === '/api/trips') {
    const all = await Promise.all((await tripIds(env)).map((id) => loadTrip(env, id)))
    return json({ trips: all.filter(Boolean).map((s) => published(s!)) })
  }

  if (req.method !== 'POST') return json({ error: 'Not found' }, 404)

  if (path === '/api/trips') {
    const body = await readBody<{ ops?: unknown; summary?: string; tripId?: unknown }>(req)
    const parsed = opsSchema.safeParse(body.ops)
    if (!parsed.success) return json({ error: '修改內容格式不對' }, 400)
    const draft = await draftTrip(env)
    const applied = applyOps(draft.trip, parsed.data)
    if (applied.errors.length) return json({ error: '這份行程有問題', details: applied.errors }, 409)
    const trip = { ...applied.trip, id: newTripId(body.tripId, applied.trip.startDate, await tripIds(env)) }
    const errors = validateTrip(trip)
    if (errors.length) return json({ error: '這份行程有問題', details: errors }, 409)
    const created = await createTrip(env, trip, String(body.summary ?? `建立行程：${trip.title}`).slice(0, 200), {
      changes: applied.changes,
      by: user.name,
    })
    return json({ ...published(created), changes: applied.changes })
  }

  if (path === '/api/auth/invites') {
    const body = await readBody<{ for?: unknown }>(req)
    const createdAt = new Date().toISOString()
    // 新旅伴的名字由對方加入時自己填
    const invite = body.for === 'person' ? { createdAt } : { userId: user.id, name: user.name, createdAt }
    return json(await createInvite(env, invite))
  }
  if (path === '/api/auth/profile') {
    const next = await renameUser(env, user, (await readBody<{ name?: unknown }>(req)).name)
    return json({ user: publicUser(next) })
  }
  if (path === '/api/auth/credentials/remove') {
    await removeCredential(env, user, (await readBody<{ id?: unknown }>(req)).id)
    return json({ ok: true })
  }

  if (path === '/api/chat') {
    const result = await chat(req, env)
    if (result instanceof Response) return result
    ctx.waitUntil(result.work)
    return result.response
  }

  const m = path.match(/^\/api\/trips\/([\w-]+)\/(apply|undo)$/)
  if (!m) return json({ error: 'Not found' }, 404)
  const [, id, action] = m
  const stored = await loadTrip(env, id)
  if (!stored) return json({ error: '找不到這個行程' }, 404)

  if (action === 'undo') {
    const next = await undo(env, id, stored, user.name)
    if (!next) return json({ error: '沒有可以復原的版本' }, 409)
    return json({ ...published(next), summary: next.summary })
  }

  const body = await readBody<{ ops?: unknown; summary?: string; source?: string }>(req)
  const parsed = opsSchema.safeParse(body.ops)
  if (!parsed.success) return json({ error: '修改內容格式不對' }, 400)
  // 一律套在最新版本上：AI 提案之後若另一個人改過，這裡會重新檢查一次
  const applied = applyOps(stored.trip, parsed.data)
  if (applied.errors.length) return json({ error: '這個修改跟目前的行程對不起來', details: applied.errors }, 409)
  const next = await saveTrip(env, id, applied.trip, String(body.summary ?? '修改行程').slice(0, 200), stored, {
    source: body.source === 'manual' ? 'manual' : 'ai',
    changes: applied.changes,
    by: user.name,
  })
  return json({ ...published(next), changes: applied.changes })
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    const url = new URL(req.url)
    // 網頁檔（wrangler.jsonc 設定成只有 /api/* 會先進到這裡，這行是保險）
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)

    try {
      // 會改東西的請求只接受從網站本身送來的
      if (req.method !== 'GET' && !sameOrigin(req)) return json({ error: '不接受從其他網站送來的請求' }, 403)

      if (req.method === 'POST') {
        const auth = await authRoutes(req, env, url.pathname)
        if (auth) return auth
      }

      const session = await currentUser(req, env)
      if (!session) return json({ error: '請先登入' }, 401)
      return withCookie(await signedInRoutes(req, env, url.pathname, session.user, ctx), session.setCookie)
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.message }, e.status)
      console.error(e)
      return json({ error: '伺服器出錯了，請稍後再試' }, 500)
    }
  },
} satisfies ExportedHandler<Env>
