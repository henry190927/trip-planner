export interface Env {
  TRIPS: KVNamespace
  RELAY: DurableObjectNamespace<import('./relay').GeminiRelay>
  GEMINI_API_KEY: string
  APP_PASSCODE: string
  MODEL: string
  /** 主模型塞車或不能用時改用這個 */
  FALLBACK_MODEL: string
  /** 逗號分隔；另外一律允許 localhost 與區網 IP（開發用） */
  ALLOWED_ORIGINS: string
}
