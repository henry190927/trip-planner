import type { Env } from './env'
import { BLOCKED_DOMAINS, blockedHosts, checkResult, hostOf, type RawResult } from './safety'

// 網頁搜尋用 Tavily（免費方案每月 1000 次）。Gemini 內建的 Google 搜尋在免費方案沒有額度，
// 而且每查一次就多用一次 Gemini 的每日請求數；這裡把搜尋結果直接交給模型讀。

export interface Source {
  title: string
  url: string
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
  const verdicts = all.map((r) => checkResult(query, r))
  const passed = all.filter((_, i) => verdicts[i] === 'ok')
  const bad = await blockedHosts(passed.map((r) => hostOf(r.url!)))
  const results = passed.filter((r) => !bad.has(hostOf(r.url!)))
  const unsafe = verdicts.filter((v) => v === 'unsafe').length + (passed.length - results.length)
  const dropped = all.filter((r) => !results.includes(r))
  if (dropped.length) console.log(`search「${query}」過濾掉 ${dropped.length} 筆（${unsafe} 筆有安全疑慮）：`, dropped.map((r) => r.url))
  return {
    // Tavily 的摘要是參考全部結果寫的，有可疑網站時就不用，讓模型只讀留下來的
    answer: unsafe ? '' : (data.answer ?? ''),
    results: results.map((r) => ({ title: r.title ?? '', url: r.url!, snippet: (r.content ?? '').slice(0, 600) })),
    sources: results.slice(0, 6).map((r): Source => ({ title: r.title || r.url!, url: r.url! })),
  }
}

export type SearchResult =
  | { query: string; error: string }
  | { query: string; answer: string; results: { title: string; url: string; snippet: string }[] }

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
  const results = settled.map((r, i): SearchResult => {
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
