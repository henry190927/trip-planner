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

async function call(env: Env, method: string, body: unknown, query = '') {
  const models = [env.MODEL, env.FALLBACK_MODEL].filter(Boolean)
  let error: GeminiError | undefined
  for (const model of models) {
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
  candidates?: { content?: { parts?: Part[] }; finishReason?: string; groundingMetadata?: GroundingMetadata }[]
}

/** 串流呼叫：每收到一段就 yield 一次 */
export async function* streamGenerate(env: Env, body: unknown): AsyncGenerator<Chunk> {
  const res = await call(env, 'streamGenerateContent', body, '?alt=sse')
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

interface GroundingMetadata {
  groundingChunks?: { web?: { uri?: string; title?: string } }[]
  webSearchQueries?: string[]
}

export interface Source {
  title: string
  url: string
}

/** 用 Google 搜尋查資料。搜尋不能跟函式呼叫放在同一個請求，所以獨立呼叫一次 */
export async function searchWeb(env: Env, query: string, today: string) {
  const res = await call(env, 'generateContent', {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `今天是 ${today}。請用 Google 搜尋查證後，用繁體中文簡潔回答，列出具體資訊（地址、營業時間、價格、交通等），查不到的就說查不到，不要猜：\n${query}`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
  })
  const data = (await res.json()) as Chunk
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join('')
  const seen = new Set<string>()
  const sources: Source[] = []
  for (const c of candidate?.groundingMetadata?.groundingChunks ?? []) {
    const url = c.web?.uri
    if (!url || seen.has(url)) continue
    seen.add(url)
    sources.push({ title: c.web?.title ?? url, url })
  }
  return { text: text || '查不到相關資料。', sources: sources.slice(0, 6) }
}
