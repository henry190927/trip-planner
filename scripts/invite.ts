// 產生邀請連結（第一次設定、或兩個人的手機都不見時用；平常在 App 的「帳號」裡產生就好）。
//
//   npm run invite                        邀請一位新旅伴（名字由對方打開連結時自己填）
//   npm run invite -- --user <帳號 id>     替已經有的帳號加一台新裝置（id 見 npm run users）
//
// 連結 24 小時內有效、用一次就失效。
import { createInvite, getUser } from '../worker/auth'
import { SITE, env } from './kv'

const args = process.argv.slice(2)
const userFlag = args.indexOf('--user')
let invite
if (userFlag >= 0) {
  const user = await getUser(env, args[userFlag + 1] ?? '')
  if (!user) {
    console.error('找不到這個帳號')
    process.exit(1)
  }
  invite = { userId: user.id, name: user.name, createdAt: new Date().toISOString() }
} else {
  invite = { createdAt: new Date().toISOString() }
}
const { code, expiresAt } = await createInvite(env, invite)
console.log(`${'userId' in invite ? `替「${invite.name}」加新裝置` : '邀請新旅伴'}的連結（到 ${new Date(expiresAt).toLocaleString('zh-TW')} 前有效、用一次就失效）：`)
console.log(`${SITE}/#/join/${code}`)
