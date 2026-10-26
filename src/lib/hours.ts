import type { OpenRange } from '../types'

// 「現在營業中」：用旅程當地的日期與時間判斷，沒有營業時段資料時回傳 unknown
const dayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

export type OpenStatus = 'open' | 'closed' | 'unknown'

export function openStatus(open: OpenRange[] | undefined, date: string, time: string): OpenStatus {
  if (!open?.length) return 'unknown'
  const today = dayOf(date)
  const yesterday = (today + 6) % 7
  const now = minutes(time)
  for (const r of open) {
    const from = minutes(r.from)
    const to = minutes(r.to)
    const overnight = to <= from
    // 今天開始的時段
    if (r.days.includes(today) && now >= from && (overnight || now < to)) return 'open'
    // 昨天開始、營業到今天凌晨的時段
    if (overnight && r.days.includes(yesterday) && now < to) return 'open'
  }
  return 'closed'
}
