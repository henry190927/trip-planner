import { afterEach, describe, expect, it, vi } from 'vitest'
import { trips } from '../src/trips'
import { normalizeOps, runAgent, searchDigest, type ChatEvent } from './agent'
import type { Env } from './env'
import { GeminiError } from './gemini'

const stored = { version: 3, updatedAt: '', summary: '', trip: trips[0] }

const sse = (parts: unknown[]) =>
  new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts } }] })}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
const busyResponse = () => Response.json({ error: { message: 'high demand' } }, { status: 503 })

/** Gemini 依序回傳 geminiReplies（用完後一直回最後一個）；Tavily 與 DNS 都正常；kv 是假的 KV */
function fakeEnv(geminiReplies: (() => Response)[], kv = new Map<string, string>()) {
  let n = 0
  const gemini = vi.fn(async (_req: Request) => geminiReplies[Math.min(n++, geminiReplies.length - 1)]())
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('dns-query')) return Response.json({ Status: 0, Answer: [{ type: 1, data: '1.2.3.4' }] })
      return Response.json({
        answer: 'MISS 豬腳營業到 24:00',
        results: [{ title: '미쓰족발 홍대', url: 'https://blog.example/miss', content: '미쓰족발 영업시간 24:00' }],
      })
    }),
  )
  const env = {
    MODEL: 'main',
    FALLBACK_MODELS: 'lite',
    TAVILY_API_KEY: 'tvly-test',
    GEMINI_API_KEY: 'k',
    TRIPS: { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => void kv.set(k, v) },
    RELAY: { idFromName: () => ({}), get: () => ({ fetch: gemini }) },
  } as unknown as Env
  return { env, gemini, kv }
}

async function run(env: Env) {
  const events: ChatEvent[] = []
  const done = runAgent(env, stored, [{ role: 'user', text: 'MISS 豬腳營業到幾點？' }], (e) => events.push(e))
  // 重試之間會等幾秒，用假的計時器快轉
  const settled = done.then(
    () => null,
    (e: unknown) => e,
  )
  await vi.runAllTimersAsync()
  return { events, error: await settled }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('runAgent 遇到模型塞車', () => {
  it('已經搜尋過時，改給搜尋摘要，並在重試時告訴使用者', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { env, gemini } = fakeEnv([() => sse([{ functionCall: { name: 'web_search', args: { queries: ['미쓰족발 홍대 영업시간'] } } }]), busyResponse])
    const { events, error } = await run(env)
    expect(error).toBeNull()
    const text = events.filter((e) => e.type === 'text').map((e) => e.delta).join('')
    expect(text).toContain('先給你搜尋到的重點')
    expect(text).toContain('MISS 豬腳營業到 24:00')
    expect(events).toContainEqual({ type: 'status', text: '小樹那邊有點塞，再試一次…' })
    // 第一次成功 + 兩個模型各試兩次
    expect(gemini).toHaveBeenCalledTimes(5)
  })

  it('還沒搜尋就塞車時照常回報錯誤', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { env } = fakeEnv([busyResponse])
    const { events, error } = await run(env)
    expect(error).toBeInstanceOf(GeminiError)
    expect(events.some((e) => e.type === 'text')).toBe(false)
  })

  it('塞車後重試成功就照常回答', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { env } = fakeEnv([busyResponse, () => sse([{ text: '營業到 24:00' }])])
    const { events, error } = await run(env)
    expect(error).toBeNull()
    expect(events).toContainEqual({ type: 'text', delta: '營業到 24:00' })
  })
})

describe('searchDigest', () => {
  it('有摘要用摘要、沒有就列前兩筆連結、失敗的標出來', () => {
    const text = searchDigest([
      { query: 'A 店', answer: 'A 營業到 22:00', results: [] },
      { query: 'B 店', answer: '', results: [{ title: 'B 店官網', url: 'https://b.example', snippet: 'B 的營業時間\n是 10:00' }] },
      { query: 'C 店', error: '沒查到' },
    ])
    expect(text).toContain('**A 店**\nA 營業到 22:00')
    expect(text).toContain('- [B 店官網](https://b.example)：B 的營業時間 是 10:00')
    expect(text).toContain('**C 店**\n這一項沒查到。')
  })
})

describe('normalizeOps', () => {
  it('新地點的 null 欄位去掉，spotChanges 的 null 保留（代表刪除）', () => {
    const ops = normalizeOps([
      { op: 'add_spot', spot: { place: { name: 'A', local: null }, category: 'cafe', hours: null }, changes: null, ref: '' },
      { op: 'update_spot', ref: 'A', spotChanges: { verify: null } },
    ])
    expect(ops).toEqual([
      { op: 'add_spot', spot: { place: { name: 'A' }, category: 'cafe' } },
      { op: 'update_spot', ref: 'A', spotChanges: { verify: null } },
    ])
  })
})

describe('模型冷卻', () => {
  const modelOf = (call: unknown[]) => new URL((call[0] as Request).url).pathname.split('/').at(-1)!.split(':')[0]
  const quota = () => Response.json({ error: { message: 'quota' } }, { status: 429 })

  it('額度用完的模型記上冷卻，下一次直接跳過', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const kv = new Map<string, string>()
    const first = fakeEnv([quota, () => sse([{ text: '好' }])], kv)
    await run(first.env)
    expect(first.gemini.mock.calls.map(modelOf)).toEqual(['main', 'lite'])
    expect(kv.get('cooldown:main')).toBe('429')

    const second = fakeEnv([() => sse([{ text: '好' }])], kv)
    await run(second.env)
    expect(second.gemini.mock.calls.map(modelOf)).toEqual(['lite'])
  })

  it('全部都在冷卻時還是照順序試', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const kv = new Map([
      ['cooldown:main', '429'],
      ['cooldown:lite', '429'],
    ])
    const { env, gemini } = fakeEnv([() => sse([{ text: '好' }])], kv)
    const { error } = await run(env)
    expect(error).toBeNull()
    expect(gemini.mock.calls.map(modelOf)).toEqual(['main'])
  })
})
