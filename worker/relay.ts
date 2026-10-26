import type { Env } from './env'

// Gemini 不支援香港等地區，而 Worker 是在離使用者最近的機房執行、從那裡連出去。
// 從台灣連線常被分到香港機房，於是請求會被 Google 以「地區不支援」拒絕。
// Durable Object 建立時可以指定位置，所以把對 Gemini 的請求都交給一個固定在美西的物件轉發
// （物件本身在 relay-object.ts，分開放是為了讓這裡不依賴 Cloudflare 專用的模組，測試才載得進來）。
export function relayFetch(env: Env, url: string, init: RequestInit) {
  const stub = env.RELAY.get(env.RELAY.idFromName('us-west'), { locationHint: 'wnam' })
  return stub.fetch(new Request(url, init))
}
