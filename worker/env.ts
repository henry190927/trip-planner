export interface Env {
  TRIPS: KVNamespace
  RELAY: DurableObjectNamespace<import('./relay-object').GeminiRelay>
  GEMINI_API_KEY: string
  /** 網頁搜尋；沒設定時 AI 會說明沒辦法查 */
  TAVILY_API_KEY?: string
  APP_PASSCODE: string
  MODEL: string
  /** 主模型塞車或不能用時依序改用這些（逗號分隔） */
  FALLBACK_MODELS: string
  /** 逗號分隔；另外一律允許 localhost 與區網 IP（開發用） */
  ALLOWED_ORIGINS: string
}
