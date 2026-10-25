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
