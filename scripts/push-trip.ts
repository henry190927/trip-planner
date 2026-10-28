// 把 src/trips/ 裡的行程（程式碼版本）推上線，成為新的一版。
// 用在：直接改了行程檔、想讓線上也採用這份時。線上用 AI 改過的內容會被這份取代，但舊版會保留、可以復原。
//
//   APP_PASSCODE=<通關密語> npm run push-trip -- seoul-2026-11
//   SUMMARY=<鈴鐺上顯示的說明> 可以自訂這次同步的說明，預設「從程式碼同步」
import { trips } from '../src/trips'

const id = process.argv[2]
const passcode = process.env.APP_PASSCODE
const trip = trips.find((t) => t.id === id)
if (!trip || !passcode) {
  console.error(`用法：APP_PASSCODE=<通關密語> npm run push-trip -- <${trips.map((t) => t.id).join(' | ')}>`)
  process.exit(1)
}
const base = process.env.VITE_API_BASE ?? 'https://trip-chat.travel-planner-hm1d.workers.dev'
const res = await fetch(`${base}/api/trips/${id}/replace`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${passcode}` },
  body: JSON.stringify({ trip, summary: process.env.SUMMARY || '從程式碼同步' }),
})
const body = (await res.json()) as { version?: number; error?: string; details?: string[] }
if (!res.ok) {
  console.error(`失敗（${res.status}）：${body.error}`, body.details ?? '')
  process.exit(1)
}
console.log(`已上線：${id} 第 ${body.version} 版`)
