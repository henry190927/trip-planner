export interface Env {
  TRIPS: KVNamespace
  RELAY: DurableObjectNamespace<import('./relay-object').GeminiRelay>
  GEMINI_API_KEY: string
  /** 網頁搜尋；沒設定時 AI 會說明沒辦法查 */
  TAVILY_API_KEY?: string
  MODEL: string
  /** 主模型塞車或不能用時依序改用這些（逗號分隔） */
  FALLBACK_MODELS: string
  /** 網站的網頁檔（dist/） */
  ASSETS: Fetcher
}
