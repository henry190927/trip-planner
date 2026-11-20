// 列出帳號與各自的裝置（替某人加新裝置時要用帳號 id）
//   npm run users
import type { User } from '../worker/auth'
import { env } from './kv'
import { execFileSync } from 'node:child_process'

const target = process.env.KV_LOCAL ? ['--local', '--persist-to', process.env.KV_LOCAL] : ['--remote']
const keys = JSON.parse(
  execFileSync('npx', ['wrangler', 'kv', 'key', 'list', '--prefix', 'user:', '--binding', 'TRIPS', ...target], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
) as { name: string }[]
for (const { name } of keys) {
  const user = (await env.TRIPS.get(name, 'json')) as User | null
  if (!user) continue
  console.log(`${user.name}（id: ${user.id}）`)
  for (const c of user.credentials) console.log(`  - ${c.label}，加入 ${c.createdAt.slice(0, 10)}${c.lastUsedAt ? `，上次使用 ${c.lastUsedAt.slice(0, 10)}` : ''}`)
}
