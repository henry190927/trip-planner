import { tripSchema } from '../schema'
import type { Trip } from '../types'

// 型別檢查抓不到的資料錯誤。行程檔的測試、AI 修改行程後的檢查都用這一份。
export function integrityErrors(trip: Trip): string[] {
  const errors: string[] = []

  if (trip.days[0]?.date !== trip.startDate) errors.push(`第一天應該是 ${trip.startDate}`)
  if (trip.days.at(-1)?.date !== trip.endDate) errors.push(`最後一天應該是 ${trip.endDate}`)
  const dates = trip.days.map((d) => d.date)
  if (new Set(dates).size !== dates.length) errors.push('有重複的日期')

  for (const day of trip.days) {
    const times = day.items.map((i) => i.time).filter((t) => t !== undefined)
    if (times.join() !== [...times].sort().join()) errors.push(`${day.date} 的項目沒有依時間排序`)
  }

  const routeIds = new Set(trip.routes.map((r) => r.id))
  const spotIds = new Set((trip.spots ?? []).map((s) => s.id))
  if (spotIds.size !== (trip.spots ?? []).length) errors.push('地點 id 重複')
  const travelerIds = new Set(trip.travelers.map((t) => t.id))
  for (const day of trip.days)
    for (const item of day.items) {
      if (item.routeId && !routeIds.has(item.routeId)) errors.push(`「${item.title}」的 routeId「${item.routeId}」不存在`)
      for (const id of item.who ?? []) if (!travelerIds.has(id)) errors.push(`「${item.title}」的旅伴「${id}」不存在`)
      if (item.spotId && !spotIds.has(item.spotId)) errors.push(`「${item.title}」的地點「${item.spotId}」不在地點清單裡`)
      for (const alt of item.alternatives ?? []) {
        if (alt.spotId && !spotIds.has(alt.spotId)) errors.push(`「${item.title}」的備案「${alt.title}」的地點「${alt.spotId}」不在地點清單裡`)
        if (alt.routeId && !routeIds.has(alt.routeId)) errors.push(`「${item.title}」的備案「${alt.title}」的 routeId「${alt.routeId}」不存在`)
      }
      if ((item.alternatives ?? []).filter((a) => a.original).length > 1) errors.push(`「${item.title}」有不只一個「原本的安排」`)
      if (item.private && !item.who?.length) errors.push(`「${item.title}」是私人的，要填負責人（who）`)
    }
  for (const r of trip.routes) {
    for (const id of r.who ?? []) if (!travelerIds.has(id)) errors.push(`路線「${r.title}」的旅伴「${id}」不存在`)
    if (r.options.filter((o) => o.recommended).length !== 1) errors.push(`路線「${r.title}」要剛好一個推薦方案`)
  }

  if (routeIds.size !== trip.routes.length) errors.push('路線 id 重複')
  const checklistIds = trip.checklist.flatMap((g) => g.items.map((i) => i.id))
  if (new Set(checklistIds).size !== checklistIds.length) errors.push('清單 id 重複')

  return errors
}

/** 完整檢查：格式（schema）+ 資料完整性 */
export function validateTrip(trip: unknown): string[] {
  const parsed = tripSchema.safeParse(trip)
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.')}：${i.message}`)
  return integrityErrors(parsed.data)
}
