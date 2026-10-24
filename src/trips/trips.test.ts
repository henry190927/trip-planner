import { describe, expect, it } from 'vitest'
import { tripSchema } from '../schema'
import { trips } from '.'

// 資料檔是手寫的，這裡把「型別檢查抓不到」的錯誤擋在部署之前
describe.each(trips.map((t) => [t.id, t] as const))('%s', (_, trip) => {
  it('符合 schema', () => {
    const result = tripSchema.safeParse(trip)
    expect(result.success, result.error?.message).toBe(true)
  })

  it('每天的日期連續且落在旅程期間', () => {
    expect(trip.days[0].date).toBe(trip.startDate)
    expect(trip.days.at(-1)!.date).toBe(trip.endDate)
    const dates = trip.days.map((d) => d.date)
    expect(new Set(dates).size).toBe(dates.length)
  })

  it('同一天的項目依時間排序', () => {
    for (const day of trip.days) {
      const times = day.items.map((i) => i.time).filter((t) => t !== undefined)
      expect(times, day.date).toEqual([...times].sort())
    }
  })

  it('routeId 都指到存在的路線', () => {
    const ids = new Set(trip.routes.map((r) => r.id))
    for (const day of trip.days)
      for (const item of day.items) if (item.routeId) expect(ids, `${day.date} ${item.title}`).toContain(item.routeId)
  })

  it('who 都是存在的旅伴', () => {
    const ids = new Set(trip.travelers.map((t) => t.id))
    const all = [...trip.days.flatMap((d) => d.items), ...trip.routes]
    for (const x of all) for (const id of x.who ?? []) expect(ids, x.title).toContain(id)
  })

  it('路線 id、清單 id 不重複', () => {
    const routeIds = trip.routes.map((r) => r.id)
    expect(new Set(routeIds).size).toBe(routeIds.length)
    const itemIds = trip.checklist.flatMap((g) => g.items.map((i) => i.id))
    expect(new Set(itemIds).size).toBe(itemIds.length)
  })

  it('每條路線剛好一個推薦方案', () => {
    for (const r of trip.routes) expect(r.options.filter((o) => o.recommended), r.id).toHaveLength(1)
  })
})
