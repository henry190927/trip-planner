// 在電腦上對線上最新版的行程套用修改動作（跟小樹、App 用的是同一套，見 src/schema.ts 的 opSchema）。
// 一律套在最新版上，不會蓋掉 App 裡改過的內容；存成新的一版，鈴鐺看得到、可以復原。
//
//   npm run apply-ops -- <行程 id> <修改動作.json>
//   SUMMARY=<鈴鐺上的說明> 可以自訂說明
import { readFileSync } from 'node:fs'
import { applyOps } from '../src/lib/ops'
import { opsSchema } from '../src/schema'
import { loadTrip, saveTrip } from '../worker/store'
import { env } from './kv'

const [id, file] = process.argv.slice(2)
if (!id || !file) {
  console.error('用法：npm run apply-ops -- <行程 id> <修改動作.json>')
  process.exit(1)
}
const parsed = opsSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
if (!parsed.success) {
  console.error('修改動作格式不對：\n' + parsed.error.issues.map((i) => `- ${i.path.join('.')}：${i.message}`).join('\n'))
  process.exit(1)
}
const current = await loadTrip(env, id)
if (!current) {
  console.error(`線上沒有 ${id}`)
  process.exit(1)
}
const applied = applyOps(current.trip, parsed.data)
if (applied.errors.length) {
  console.error('套不上去：\n' + applied.errors.map((e) => `- ${e}`).join('\n'))
  process.exit(1)
}
const summary = process.env.SUMMARY || `從電腦套用 ${parsed.data.length} 個修改`
const next = await saveTrip(env, id, applied.trip, summary, current, { source: 'manual', changes: applied.changes, by: 'Claude Code' })
console.log(`已更新：${id} 第 ${current.version} 版 → 第 ${next.version} 版`)
for (const c of applied.changes) console.log(`  ${c.kind === 'add' ? '+' : c.kind === 'remove' ? '-' : '~'} ${c.text}`)
