import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env'
import { searchMany } from './search'

const env = { TAVILY_API_KEY: 'tvly-test' } as Env

function mockTavily(handler: (query: string) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => handler((JSON.parse(String(init.body)) as { query: string }).query)),
  )
}

const ok = (query: string, urls: string[]) =>
  Response.json({ answer: `${query} 的答案`, results: urls.map((url) => ({ title: url, url, content: '摘要' })) })

afterEach(() => vi.unstubAllGlobals())

describe('searchMany', () => {
  it('同時查多項，結果按原本的順序收回', async () => {
    mockTavily(async (q) => {
      // 第一項故意比較慢，確認不是依完成順序排列
      if (q === 'A') await new Promise((r) => setTimeout(r, 20))
      return ok(q, [`https://${q}.example`])
    })
    const found = await searchMany(env, ['A', 'B', 'C'])
    expect(found.results.map((r) => r.query)).toEqual(['A', 'B', 'C'])
    expect(found.failed).toBe(0)
    expect(found.results[0]).toMatchObject({ answer: 'A 的答案' })
  })

  it('其中一項失敗時其他項照常回傳，失敗的那項會標出來', async () => {
    mockTavily((q) => (q === 'B' ? new Response('boom', { status: 500 }) : ok(q, [`https://${q}.example`])))
    const found = await searchMany(env, ['A', 'B', 'C'])
    expect(found.failed).toBe(1)
    expect(found.results[1]).toMatchObject({ query: 'B', error: expect.stringContaining('沒查到') })
    expect(found.results[2]).toMatchObject({ query: 'C', answer: 'C 的答案' })
  })

  it('來源去重複，問題去重複並限制數量', async () => {
    mockTavily((q) => ok(q, ['https://same.example', `https://${q}.example`]))
    const found = await searchMany(env, ['A', 'A', ' ', 'B', 'C', 'D', 'E'])
    expect(found.queries).toEqual(['A', 'B', 'C', 'D'])
    expect(found.sources.filter((s) => s.url === 'https://same.example')).toHaveLength(1)
    expect(found.sources.length).toBeLessThanOrEqual(8)
  })
})
