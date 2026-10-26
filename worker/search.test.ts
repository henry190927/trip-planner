import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env'
import { searchMany, searchWeb } from './search'

const env = { TAVILY_API_KEY: 'tvly-test' } as Env

interface Fake {
  tavily: (query: string) => Response | Promise<Response>
  /** 家庭版 DNS 會擋掉的網域 */
  dnsBlocked?: string[]
}

function mockNet({ tavily, dnsBlocked = [] }: Fake) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('dns-query')) {
        const host = new URL(url).searchParams.get('name')!
        const ip = dnsBlocked.includes(host) ? '0.0.0.0' : '1.2.3.4'
        return Response.json({ Status: 0, Answer: [{ type: 1, data: ip }] })
      }
      return tavily((JSON.parse(String(init?.body)) as { query: string }).query)
    }),
  )
}

const result = (url: string, title = url, content = '') => ({ title, url, content })
const ok = (query: string, results: ReturnType<typeof result>[]) => Response.json({ answer: `${query} 的答案`, results })

afterEach(() => vi.unstubAllGlobals())

describe('searchMany', () => {
  it('同時查多項，結果按原本的順序收回', async () => {
    mockNet({
      tavily: async (q) => {
        // 第一項故意比較慢，確認不是依完成順序排列
        if (q === '가게A') await new Promise((r) => setTimeout(r, 20))
        return ok(q, [result(`https://${q}.example`, q)])
      },
    })
    const found = await searchMany(env, ['가게A', '가게B', '가게C'])
    expect(found.results.map((r) => r.query)).toEqual(['가게A', '가게B', '가게C'])
    expect(found.failed).toBe(0)
    expect(found.results[0]).toMatchObject({ answer: '가게A 的答案' })
  })

  it('其中一項失敗時其他項照常回傳，失敗的那項會標出來', async () => {
    mockNet({ tavily: (q) => (q === '가게B' ? new Response('boom', { status: 500 }) : ok(q, [result(`https://${q}.example`, q)])) })
    const found = await searchMany(env, ['가게A', '가게B', '가게C'])
    expect(found.failed).toBe(1)
    expect(found.results[1]).toMatchObject({ query: '가게B', error: expect.stringContaining('沒查到') })
    expect(found.results[2]).toMatchObject({ query: '가게C', answer: '가게C 的答案' })
  })

  it('來源去重複，問題去重複並限制數量', async () => {
    mockNet({ tavily: (q) => ok(q, [result('https://same.example', `${q} 共同`), result(`https://${q}.example`, q)]) })
    const found = await searchMany(env, ['가게A', '가게A', ' ', '가게B', '가게C', '가게D', '가게E'])
    expect(found.queries).toEqual(['가게A', '가게B', '가게C', '가게D'])
    expect(found.sources.filter((s) => s.url === 'https://same.example')).toHaveLength(1)
    expect(found.sources.length).toBeLessThanOrEqual(8)
  })
})

describe('searchWeb 的過濾', () => {
  const q = '일편등심 홍대'

  it('家庭版 DNS 判定有問題的網站被拿掉，有可疑網站時也不採用 Tavily 的摘要', async () => {
    mockNet({
      tavily: () => ok(q, [result('https://good.example/a', '일편등심 홍대본점'), result('https://phish.example/b', '일편등심 할인')]),
      dnsBlocked: ['phish.example'],
    })
    const r = await searchWeb(env, q)
    expect(r.sources.map((s) => s.url)).toEqual(['https://good.example/a'])
    expect(r.answer).toBe('')
  })

  it('只有不相關的結果被拿掉時，照常採用摘要', async () => {
    mockNet({ tavily: () => ok(q, [result('https://good.example/a', '일편등심 홍대본점'), result('https://other.example/b', '홍대 맛집 BEST')]) })
    const r = await searchWeb(env, q)
    expect(r.sources.map((s) => s.url)).toEqual(['https://good.example/a'])
    expect(r.answer).toBe(`${q} 的答案`)
  })
})
