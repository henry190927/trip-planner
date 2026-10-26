import { afterEach, describe, expect, it, vi } from 'vitest'
import { blockedHosts, checkResult, keepResult } from './safety'

const q = '일편등심 홍대 네이버 예약'

describe('checkResult', () => {
  it('擋掉成人網站（網域或標題）', () => {
    expect(keepResult(q, { title: 'Pornhub Videos & Streaming', url: 'https://www.pornhub.com/x', content: '일편등심' })).toBe(false)
    expect(keepResult(q, { title: 'pornhub videos - XVIDEOS.COM', url: 'https://spam.example/일편등심', content: '일편등심' })).toBe(false)
    expect(keepResult(q, { title: 'Videos Porno y Películas', url: 'https://es.spam.example/', content: '일편등심 홍대' })).toBe(false)
  })

  it('擋掉賭博、詐騙、借貸、色情按摩，內文出現也算', () => {
    expect(checkResult(q, { title: '일편등심 홍대 후기', url: 'https://a.example', content: '먹튀검증 토토사이트 추천' })).toBe('unsafe')
    expect(checkResult(q, { title: '일편등심 카지노 쿠폰', url: 'https://a.example', content: '' })).toBe('unsafe')
    expect(checkResult(q, { title: '일편등심', url: 'https://a.example', content: '무직자대출 급전 당일' })).toBe('unsafe')
    expect(checkResult(q, { title: '일편등심 홍대 출장안마', url: 'https://a.example', content: '' })).toBe('unsafe')
    expect(checkResult(q, { title: '일편등심 FREE GIVEAWAY', url: 'https://a.example', content: 'claim your airdrop' })).toBe('unsafe')
  })

  it('擋掉直接用 IP 的網址與詐騙常用網域', () => {
    expect(checkResult(q, { title: '일편등심', url: 'http://103.21.4.5/menu' })).toBe('unsafe')
    expect(checkResult(q, { title: '일편등심', url: 'https://ilpyeon-deal.xyz/' })).toBe('unsafe')
    expect(checkResult(q, { title: '일편등심', url: 'https://korea-eats.top/a' })).toBe('unsafe')
    expect(checkResult(q, { title: '일편등심', url: 'javascript:alert(1)' })).toBe('unsafe')
  })

  it('擋掉跟店名完全無關的結果，只提到通用字（홍대、예약）不算相關', () => {
    expect(checkResult(q, { title: '홍대 맛집 BEST 10', url: 'https://blog.example/a', content: '홍대 예약 필수' })).toBe('irrelevant')
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

  it('一般用語不會被誤擋：成人票、오피스텔、TOTO', () => {
    expect(keepResult('AREX 직통열차 요금', { title: 'AREX 직통열차 요금 성인 11,000원', url: 'https://arex.example/' })).toBe(true)
    expect(keepResult('홍대 숙소', { title: '홍대 오피스텔 숙소 후기', url: 'https://blog.example/a' })).toBe(true)
    expect(keepResult('TOTO 매장', { title: 'TOTO 매장 위치', url: 'https://toto.example/a' })).toBe(true)
  })

  it('搜尋字詞全是通用字時，用那些字判斷', () => {
    expect(keepResult('홍대 맛집', { title: '홍대 맛집 추천', url: 'https://blog.example/a', content: '' })).toBe(true)
  })
})

describe('blockedHosts', () => {
  afterEach(() => vi.unstubAllGlobals())

  const dns = (answers: Record<string, { Status: number; ip?: string } | 'fail'>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const a = answers[new URL(url).searchParams.get('name')!]
        if (a === 'fail') throw new Error('timeout')
        return Response.json({ Status: a.Status, Answer: a.ip ? [{ type: 1, data: a.ip }] : [] })
      }),
    )

  it('解析成 0.0.0.0 或網域不存在的擋掉，查詢失敗的放行', async () => {
    dns({
      'r1-bad.example': { Status: 0, ip: '0.0.0.0' },
      'r1-gone.example': { Status: 3 },
      'r1-good.example': { Status: 0, ip: '1.2.3.4' },
      'r1-flaky.example': 'fail',
    })
    const bad = await blockedHosts(['r1-bad.example', 'r1-gone.example', 'r1-good.example', 'r1-flaky.example', 'r1-bad.example'])
    expect([...bad].sort()).toEqual(['r1-bad.example', 'r1-gone.example'])
  })
})
