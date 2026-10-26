import type { Env } from './env'

// 網頁搜尋用 Tavily（免費方案每月 1000 次）。Gemini 內建的 Google 搜尋在免費方案沒有額度，
// 而且每查一次就多用一次 Gemini 的每日請求數；這裡把搜尋結果直接交給模型讀。

export interface Source {
  title: string
  url: string
}

// 有些垃圾或成人網站會在頁面塞滿熱門的店名與關鍵字，搜尋結果偶爾會混進來。
// 三道過濾：送出時排除已知網域、收回時擋成人字眼、再擋跟搜尋字詞完全無關的結果。
const BLOCKED_DOMAINS = ['pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com', 'onlyfans.com', 'spankbang.com']
// 「성인」「成人」不列入：票價、門票頁常用來指成人票
const ADULT = /porn|xvideo|xnxx|xhamster|redtube|youporn|spankbang|onlyfans|hentai|\bsex|\bxxx|야동|섹스|色情|情色|av女優/i
// 地圖與訂位網站的頁面標題常常不寫店名（例如只有「네이버 지도」），不做相關性檢查
const TRUSTED_DOMAINS = ['map.naver.com', 'place.naver.com', 'naver.me', 'map.kakao.com', 'place.map.kakao.com', 'google.com', 'catchtable.co.kr', 'tablelog.co.kr']
// 這些字幾乎每個結果都有，不能拿來判斷相關性
const GENERIC = /^(홍대|홍대입구|서울|영업시간|예약|네이버|맛집|주소|위치|메뉴|가격|弘大|首爾|營業時間|地址|訂位|預約|價格|菜單|naver|map|seoul|hongdae|open|hours|menu|price|reservation)$/i

function keywords(query: string) {
  const words = query.toLowerCase().split(/[\s,，、/()（）「」]+/).filter((w) => w.length >= 2)
  const specific = words.filter((w) => !GENERIC.test(w))
  return specific.length ? specific : words
}

interface RawResult {
  title?: string
  url?: string
  content?: string
}

/** 留下看起來正常、而且跟搜尋字詞有關的結果 */
export function keepResult(query: string, r: RawResult) {
  if (!r.url) return false
  const host = (() => {
    try {
      return new URL(r.url).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  })()
  if (!host || BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return false
  if (ADULT.test(`${r.title ?? ''} ${r.url}`)) return false
  if (TRUSTED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return true
  const haystack = `${r.title ?? ''} ${decodeURIComponentSafe(r.url)} ${r.content ?? ''}`.toLowerCase()
  const words = keywords(query)
  return words.length === 0 || words.some((k) => haystack.includes(k))
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

interface TavilyResponse {
  answer?: string
  results?: RawResult[]
}

export class SearchError extends Error {}

export async function searchWeb(env: Env, query: string, signal?: AbortSignal) {
  const key = env.TAVILY_API_KEY?.trim()
  if (!key) throw new SearchError('沒有設定 TAVILY_API_KEY')
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 6, include_answer: 'basic', exclude_domains: BLOCKED_DOMAINS }),
    signal,
  })
  if (res.status === 401) console.error(`Tavily key 長度 ${key.length}，${key.startsWith('tvly-') ? '' : '不是 '}tvly- 開頭`)
  if (!res.ok) throw new SearchError(`Tavily ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as TavilyResponse
  const all = data.results ?? []
  const results = all.filter((r) => keepResult(query, r))
  if (results.length < all.length) console.log(`search「${query}」過濾掉 ${all.length - results.length} 筆：`, all.filter((r) => !results.includes(r)).map((r) => r.url))
  return {
    answer: data.answer ?? '',
    results: results.map((r) => ({ title: r.title ?? '', url: r.url!, snippet: (r.content ?? '').slice(0, 600) })),
    sources: results.slice(0, 6).map((r): Source => ({ title: r.title || r.url!, url: r.url! })),
  }
}

export const MAX_QUERIES = 4
const QUERY_TIMEOUT_MS = 10_000

/**
 * 一次查好幾件事：各自同時搜尋，再按原本的順序收回來。
 * 某一項失敗或逾時不影響其他項，但會明確標出來，讓模型知道哪一項沒查到。
 */
export async function searchMany(env: Env, queries: string[]) {
  const list = [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, MAX_QUERIES)
  const settled = await Promise.allSettled(list.map((q) => searchWeb(env, q, AbortSignal.timeout(QUERY_TIMEOUT_MS))))

  const seen = new Set<string>()
  const sources: Source[] = []
  const results = settled.map((r, i) => {
    if (r.status === 'rejected') {
      console.error('search failed', list[i], r.reason)
      return { query: list[i], error: '這一項沒查到（搜尋失敗或逾時），回答時要說明這部分未查證' }
    }
    for (const s of r.value.sources) {
      if (seen.has(s.url)) continue
      seen.add(s.url)
      sources.push(s)
    }
    return { query: list[i], answer: r.value.answer, results: r.value.results }
  })
  return { queries: list, results, sources: sources.slice(0, 8), failed: settled.filter((r) => r.status === 'rejected').length }
}
