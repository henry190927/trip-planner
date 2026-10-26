import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './env'
import { keepResult, searchMany } from './search'

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

describe('keepResult', () => {
  const q = '일편등심 홍대 네이버 예약'

  it('擋掉成人網站（網域或標題）', () => {
    expect(keepResult(q, { title: 'Pornhub Videos & Streaming', url: 'https://www.pornhub.com/x', content: '일편등심' })).toBe(false)
    expect(keepResult(q, { title: 'pornhub videos - XVIDEOS.COM', url: 'https://spam.example/일편등심', content: '일편등심' })).toBe(false)
    expect(keepResult(q, { title: 'Videos Porno y Películas', url: 'https://es.spam.example/', content: '일편등심 홍대' })).toBe(false)
  })

  it('擋掉跟店名完全無關的結果，只提到通用字（홍대、예약）不算相關', () => {
    expect(keepResult(q, { title: '홍대 맛집 BEST 10', url: 'https://blog.example/a', content: '홍대 예약 필수' })).toBe(false)
  })

  it('留下正常的店家頁面，店名出現在標題、內容或（編碼過的）網址都算', () => {
    expect(keepResult(q, { title: '일편등심 홍대본점 — 홍대 한우', url: 'https://k.example/a', content: '' })).toBe(true)
    expect(keepResult(q, { title: 'Hongdae beef', url: 'https://k.example/a', content: '일편등심은 …' })).toBe(true)
    expect(keepResult(q, { title: 'place', url: `https://m.place.naver.com/${encodeURIComponent('일편등심')}`, content: '' })).toBe(true)
  })

  it('地圖與訂位網站即使標題沒寫店名也留下', () => {
    expect(keepResult(q, { title: '네이버 지도', url: 'https://map.naver.com/p/entry/place/34565224', content: '' })).toBe(true)
    expect(keepResult(q, { title: 'NAVER', url: 'https://m.place.naver.com/restaurant/34565224', content: '' })).toBe(true)
  })

  it('搜尋字詞全是通用字時，用那些字判斷', () => {
    expect(keepResult('홍대 맛집', { title: '홍대 맛집 추천', url: 'https://blog.example/a', content: '' })).toBe(true)
  })

  it('「成人票」這類正常用法不會被擋', () => {
    expect(keepResult('AREX 직통열차 요금', { title: 'AREX 직통열차 요금 성인 11,000원', url: 'https://arex.example/', content: '' })).toBe(true)
  })
})
