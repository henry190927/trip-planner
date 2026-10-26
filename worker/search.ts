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

export async function searchWeb(env: Env, query: string) {
  const key = env.TAVILY_API_KEY?.trim()
  if (!key) throw new SearchError('沒有設定 TAVILY_API_KEY')
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 6, include_answer: 'basic' }),
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
