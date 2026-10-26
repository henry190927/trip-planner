// 純日期工具（不依賴 React），前端與 Worker 共用
const dayMs = 86_400_000
const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`)

export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / dayMs)

const weekdays = '日一二三四五六'

export function formatDate(date: string, withWeekday = true) {
  const d = new Date(toUtc(date))
  const md = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  return withWeekday ? `${md}（${weekdays[d.getUTCDay()]}）` : md
}

export function weekday(date: string) {
  return weekdays[new Date(toUtc(date)).getUTCDay()]
}

/** 「剛剛」「5 分鐘前」「今天 14:05」「昨天 22:10」「10/25 09:00」；用這台裝置的時區 */
export function relativeTime(iso: string, now = new Date()) {
  const then = new Date(iso)
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000)
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  const hm = `${String(then.getHours()).padStart(2, '0')}:${String(then.getMinutes()).padStart(2, '0')}`
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((day(now) - day(then)) / 86400000)
  if (diff === 0) return `今天 ${hm}`
  if (diff === 1) return `昨天 ${hm}`
  return `${then.getMonth() + 1}/${then.getDate()} ${hm}`
}
