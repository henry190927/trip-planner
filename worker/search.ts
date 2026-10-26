import type { Env } from './env'

// 網頁搜尋用 Tavily（免費方案每月 1000 次）。Gemini 內建的 Google 搜尋在免費方案沒有額度，
// 而且每查一次就多用一次 Gemini 的每日請求數；這裡把搜尋結果直接交給模型讀。

export interface Source {
  title: string
  url: string
}

interface TavilyResponse {
  answer?: string
  results?: { title?: string; url?: string; content?: string }[]
}

export class SearchError extends Error {}

export async function searchWeb(env: Env, query: string, signal?: AbortSignal) {
  const key = env.TAVILY_API_KEY?.trim()
  if (!key) throw new SearchError('沒有設定 TAVILY_API_KEY')
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 5, include_answer: 'basic' }),
    signal,
  })
  if (res.status === 401) console.error(`Tavily key 長度 ${key.length}，${key.startsWith('tvly-') ? '' : '不是 '}tvly- 開頭`)
  if (!res.ok) throw new SearchError(`Tavily ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as TavilyResponse
  const results = (data.results ?? []).filter((r) => r.url)
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
