import type { Env } from './env'
import { relayFetch } from './relay'

// 直接打 Gemini 的 REST API（generateContent）。模型回傳的 part 要原封不動放回對話紀錄，
// 思考模型會在 part 上附帶簽章，少了它下一輪的函式呼叫會出錯。
export interface Part {
  text?: string
  thought?: boolean
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> }
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> }
  [key: string]: unknown
}

export interface Content {
  role: 'user' | 'model'
  parts: Part[]
}

export class GeminiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const base = 'https://generativelanguage.googleapis.com/v1beta/models'

// 免費方案的模型常塞車（503）、額度用完（429），或某些模型對這把金鑰不開放（400 地區不支援、404 不再提供），
// 這幾種就換下一個模型。每個模型的每日額度分開算，多備幾個等於多幾份額度
const retryable = (status: number, message: string) =>
  status === 503 || status === 429 || (status === 400 && /location/i.test(message)) || status === 404

// 塞車（503）通常幾秒內就會好：同一個模型等一下再試一次，還是不行再換下一個模型
const BUSY_WAITS = [0, 2000]

// 額度用完或不開放的模型先冷卻一陣子，這段時間直接跳過，不必每一步都先被拒絕一次
const cooldownKey = (model: string) => `cooldown:${model}`
// 塞車一分鐘（KV 最短的期限）、額度用完 15 分鐘、不開放的 6 小時
const cooldownSeconds = (status: number) => (status === 503 ? 60 : status === 429 ? 15 * 60 : 6 * 3600)

async function availableModels(env: Env) {
  const all = [env.MODEL, ...env.FALLBACK_MODELS.split(',').map((m) => m.trim())].filter(Boolean)
  const cooling = await Promise.all(all.map((m) => env.TRIPS.get(cooldownKey(m))))
  const ready = all.filter((_, i) => !cooling[i])
  // 全部都在冷卻就還是照順序試，總比直接放棄好
  return ready.length ? ready : all
}

async function call(env: Env, method: string, body: unknown, query = '', onRetry?: () => void) {
  const models = await availableModels(env)
  let error: GeminiError | undefined
  const attempts = models.flatMap((model) => BUSY_WAITS.map((wait) => ({ model, wait })))
  for (const { model, wait } of attempts) {
    if (wait) {
      if (error?.status !== 503) continue
      onRetry?.()
      await new Promise((r) => setTimeout(r, wait))
    }
    const res = await relayFetch(env, `${base}/${model}:${method}${query}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    })
    if (res.ok) return res
    const detail = await res.text()
    console.error(`Gemini ${model} ${method} ${res.status}`, detail.slice(0, 2000))
    let message = detail
    try {
      message = (JSON.parse(detail) as { error?: { message?: string } }).error?.message ?? detail
    } catch {
      // 不是 JSON 就用原文
    }
    error = new GeminiError(res.status, message)
    if (!retryable(res.status, message)) break
    const ttl = cooldownSeconds(res.status)
    if (ttl) await env.TRIPS.put(cooldownKey(model), String(res.status), { expirationTtl: ttl })
  }
  throw error!
}

interface Chunk {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[]
}

/** 串流呼叫：每收到一段就 yield 一次 */
export async function* streamGenerate(env: Env, body: unknown, onRetry?: () => void): AsyncGenerator<Chunk> {
  const res = await call(env, 'streamGenerateContent', body, '?alt=sse', onRetry)
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let newline: number
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line.startsWith('data:')) yield JSON.parse(line.slice(5)) as Chunk
    }
  }
}
