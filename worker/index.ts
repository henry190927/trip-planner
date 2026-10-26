import { opsSchema, tripSchema } from '../src/schema'
import { validateTrip } from '../src/lib/validate'
import { applyOps } from '../src/lib/ops'
import { runAgent, type ChatEvent, type ChatMessage } from './agent'
import type { Env } from './env'
import { GeminiError } from './gemini'
import { loadTrip, saveTrip, tripIds, undo } from './store'

export { GeminiRelay } from './relay'

// API
//   GET  /api/trips              所有行程的最新版本（公開，跟網站本身一樣）
//   POST /api/chat               聊天（SSE 串流）            需要通關密語
//   POST /api/trips/:id/apply    套用 AI 提出的修改           需要通關密語
//   POST /api/trips/:id/undo     回到上一版                   需要通關密語
//   POST /api/trips/:id/replace  用整份行程取代（scripts/push-trip.ts 用）  需要通關密語
//   POST /api/auth               檢查通關密語

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed =
    env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).includes(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
  return allowed
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-max-age': '86400',
        vary: 'origin',
      }
    : {}
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })

// 固定時間比較，避免從回應時間猜出密語
function sameSecret(a: string, b: string) {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

const authorized = (req: Request, env: Env) =>
  !!env.APP_PASSCODE && sameSecret(req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '', env.APP_PASSCODE)

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

async function chat(req: Request, env: Env, cors: Record<string, string>) {
  const body = (await req.json().catch(() => null)) as { tripId?: string; messages?: ChatMessage[] } | null
  const stored = body?.tripId ? await loadTrip(env, body.tripId) : undefined
  if (!stored) return json({ error: '找不到這個行程' }, 404, cors)
  const messages = (body?.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }))
  if (messages.at(-1)?.role !== 'user') return json({ error: '最後一則要是使用者的訊息' }, 400, cors)

  const { readable, writable } = new TransformStream<Uint8Array>()
  const writer = writable.getWriter()
  const enc = new TextEncoder()
  const emit = (e: ChatEvent) => void writer.write(enc.encode(`data: ${JSON.stringify(e)}\n\n`))

  const work = (async () => {
    try {
      await runAgent(env, stored, messages, emit)
    } catch (e) {
      console.error(e)
      emit({ type: 'error', text: geminiMessage(e) })
    }
    emit({ type: 'done' })
    await writer.close()
  })()

  return { response: new Response(readable, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', ...cors } }), work }
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    const url = new URL(req.url)
    const cors = corsHeaders(req, env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    try {
      if (req.method === 'GET' && url.pathname === '/api/trips') {
        const all = await Promise.all(tripIds().map((id) => loadTrip(env, id)))
        return json({ trips: all.filter(Boolean).map((s) => ({ version: s!.version, updatedAt: s!.updatedAt, trip: s!.trip })) }, 200, {
          ...cors,
          'cache-control': 'no-store',
        })
      }

      if (req.method !== 'POST') return json({ error: 'Not found' }, 404, cors)
      if (!authorized(req, env)) return json({ error: '通關密語不對' }, 401, cors)

      if (url.pathname === '/api/auth') return json({ ok: true }, 200, cors)
      if (url.pathname === '/api/chat') {
        const result = await chat(req, env, cors)
        if (result instanceof Response) return result
        ctx.waitUntil(result.work)
        return result.response
      }

      const m = url.pathname.match(/^\/api\/trips\/([\w-]+)\/(apply|undo|replace)$/)
      if (m) {
        const [, id, action] = m
        const stored = await loadTrip(env, id)
        if (!stored) return json({ error: '找不到這個行程' }, 404, cors)

        if (action === 'undo') {
          const next = await undo(env, id, stored)
          if (!next) return json({ error: '沒有可以復原的版本' }, 409, cors)
          return json({ version: next.version, trip: next.trip, summary: next.summary }, 200, cors)
        }

        if (action === 'replace') {
          const body = (await req.json().catch(() => null)) as { trip?: unknown; summary?: string } | null
          const errors = validateTrip(body?.trip)
          if (errors.length) return json({ error: '行程資料不正確', details: errors }, 400, cors)
          const trip = tripSchema.parse(body!.trip)
          if (trip.id !== id) return json({ error: '行程 id 不一致' }, 400, cors)
          const next = await saveTrip(env, id, trip, String(body?.summary ?? '取代行程').slice(0, 200), stored)
          return json({ version: next.version }, 200, cors)
        }

        const body = (await req.json().catch(() => null)) as { ops?: unknown; summary?: string } | null
        const parsed = opsSchema.safeParse(body?.ops)
        if (!parsed.success) return json({ error: '修改內容格式不對' }, 400, cors)
        // 一律套在最新版本上：AI 提案之後若另一個人改過，這裡會重新檢查一次
        const applied = applyOps(stored.trip, parsed.data)
        if (applied.errors.length) return json({ error: '這個修改跟目前的行程對不起來', details: applied.errors }, 409, cors)
        const next = await saveTrip(env, id, applied.trip, String(body?.summary ?? '修改行程').slice(0, 200), stored)
        return json({ version: next.version, trip: next.trip, changes: applied.changes }, 200, cors)
      }

      return json({ error: 'Not found' }, 404, cors)
    } catch (e) {
      console.error(e)
      return json({ error: e instanceof Error ? e.message : String(e) }, 500, cors)
    }
  },
} satisfies ExportedHandler<Env>
