// 把電腦上的行程檔放上線。行程資料只存在 Cloudflare KV，行程檔放在 private/（不進 git）。
//
//   npm run push-trip -- private/busan-2026-12.ts             建立新行程（線上已經有同 id 的會拒絕）
//   npm run push-trip -- private/busan-2026-12.ts --replace   用這份取代線上版本（存成新的一版，可以復原）
//
// 取代之前一定先 npm run pull-trip 把線上版拉下來對照：線上用 App 或小樹改過的內容會被蓋掉。
// 行程檔可以是 .ts（export default 或第一個匯出的行程）或 .json。
// SUMMARY=<說明> 可以自訂鈴鐺上顯示的說明。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateTrip } from '../src/lib/validate'
import { tripSchema } from '../src/schema'
import { createTrip, loadTrip, saveTrip } from '../worker/store'
import { env } from './kv'

const [path, flag] = process.argv.slice(2)
if (!path) {
  console.error('用法：npm run push-trip -- <行程檔> [--replace]')
  process.exit(1)
}

async function readTrip(file: string): Promise<unknown> {
  if (file.endsWith('.json')) {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    // 也接受 pull-trip 存下來的整份（有 version、trip）
    return data && typeof data === 'object' && 'trip' in data ? data.trip : data
  }
  const mod = (await import(pathToFileURL(resolve(file)).href)) as Record<string, unknown>
  return mod.default ?? Object.values(mod)[0]
}

const raw = await readTrip(path)
const errors = validateTrip(raw)
if (errors.length) {
  console.error('行程檔有問題：\n' + errors.map((e) => `- ${e}`).join('\n'))
  process.exit(1)
}
const trip = tripSchema.parse(raw)
const summary = process.env.SUMMARY || (flag === '--replace' ? '從電腦上的行程檔更新' : '建立行程')
const current = await loadTrip(env, trip.id)

if (!current) {
  const first = await createTrip(env, trip, summary)
  console.log(`已建立：${trip.id}（第 ${first.version} 版）`)
} else if (flag === '--replace') {
  const next = await saveTrip(env, trip.id, trip, summary, current, { source: 'sync' })
  console.log(`已更新：${trip.id} 第 ${current.version} 版 → 第 ${next.version} 版（可以在 App 裡復原）`)
} else {
  console.error(`線上已經有 ${trip.id}（第 ${current.version} 版）。要取代的話先 npm run pull-trip -- ${trip.id} 對照，再加 --replace`)
  process.exit(1)
}
