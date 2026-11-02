import { describe, expect, it } from 'vitest'
import { isPhone, mapAppUrl, mapUrl } from './maps'

const place = { name: 'MISS 豬腳 弘大店', local: '미쓰족발 홍대본점', mapQuery: '미쓰족발 홍대' }

describe('地圖連結', () => {
  it('Naver、Kakao 有 App 專屬連結，用地圖搜尋字串；Google 用網址就會開 App', () => {
    expect(mapAppUrl('naver', place)).toBe(`nmap://search?query=${encodeURIComponent('미쓰족발 홍대')}&appname=io.github.henry190927.trip-planner`)
    expect(mapAppUrl('kakao', place)).toBe(`kakaomap://search?q=${encodeURIComponent('미쓰족발 홍대')}`)
    expect(mapAppUrl('google', place)).toBeUndefined()
  })

  it('有確切連結時，手機上還是先用店名叫起 App（Naver 的 App 連結不能直接開分享連結）', () => {
    expect(mapAppUrl('naver', { ...place, mapLink: 'https://naver.me/abc' })).toBe(
      `nmap://search?query=${encodeURIComponent('미쓰족발 홍대')}&appname=io.github.henry190927.trip-planner`,
    )
  })

  it('搜尋字串被填成網址時改用當地名稱搜', () => {
    const odd = { name: '鳳山精肉 弘大總店', local: '봉산정육 홍대본점', mapQuery: 'https://map.naver.com/p/entry/place/2032494208' }
    expect(mapAppUrl('naver', odd)).toContain(encodeURIComponent('봉산정육 홍대본점'))
    expect(mapUrl('naver', odd)).toBe(`https://map.naver.com/p/search/${encodeURIComponent('봉산정육 홍대본점')}`)
  })

  it('網頁版：有指定連結就用指定的', () => {
    expect(mapUrl('naver', { ...place, mapLink: 'https://naver.me/abc' })).toBe('https://naver.me/abc')
    expect(mapUrl('google', place)).toContain('api=1')
  })

  it('判斷是不是手機', () => {
    expect(isPhone('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true)
    expect(isPhone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false)
  })
})
