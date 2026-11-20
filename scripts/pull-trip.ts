// 把線上最新版的行程存到 private/<id>.json（備份、或改之前先拿最新的）。
//   npm run pull-trip -- busan-2026-12
//   npm run pull-trip            列出所有行程
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadTrip, tripIds } from '../worker/store'
import { env } from './kv'

const id = process.argv[2]
if (!id) {
  console.log((await tripIds(env)).join('\n') || '（線上還沒有行程）')
  process.exit(0)
}
const stored = await loadTrip(env, id)
if (!stored) {
  console.error(`線上沒有 ${id}`)
  process.exit(1)
}
mkdirSync('private', { recursive: true })
const file = `private/${id}.json`
writeFileSync(file, JSON.stringify(stored, null, 2) + '\n')
console.log(`已存到 ${file}（第 ${stored.version} 版，${stored.updatedAt}）`)
