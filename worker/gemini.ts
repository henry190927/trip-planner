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

// 免費方案的模型常塞車（503）或某些模型不開放（400 地區不支援），這幾種就換備用模型再試一次
const retryable = (status: number, message: string) => status === 503 || status === 429 || (status === 400 && /location/i.test(message))

// 塞車（503）通常幾秒內就會好：同一個模型等一下再試，還是不行再換下一個模型
const BUSY_WAITS = [0, 2000, 5000]

async function call(env: Env, method: string, body: unknown, query = '', onRetry?: () => void) {
  const models = [env.MODEL, env.FALLBACK_MODEL].filter(Boolean)
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
