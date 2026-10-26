import { describe, expect, it } from 'vitest'
import { opsSchema } from '../schema'
import { seoul2026 } from '../trips/seoul-2026-11'
import { applyOps } from './ops'

const day2 = '2026-11-07'
const titles = (trip: typeof seoul2026, date: string) => trip.days.find((d) => d.date === date)!.items.map((i) => i.title)

describe('applyOps', () => {
  it('新增項目會自動依時間排進正確位置', () => {
    const r = applyOps(seoul2026, [
      { op: 'add_item', date: day2, item: { time: '11:00', kind: 'food', title: '延南洞咖啡廳', tentative: true } },
    ])
    expect(r.errors).toEqual([])
    const list = titles(r.trip, day2)
    expect(list.indexOf('延南洞咖啡廳')).toBe(list.indexOf('睡飽・早午餐') + 1)
    expect(r.changes).toEqual([{ kind: 'add', text: '11/7 11:00「延南洞咖啡廳」' }])
  })

  it('不會改到原本的資料', () => {
    const before = JSON.stringify(seoul2026)
    applyOps(seoul2026, [{ op: 'remove_item', date: day2, title: 'MISS 豬腳宵夜' }])
    expect(JSON.stringify(seoul2026)).toBe(before)
  })

  it('修改時間後重新排序，null 會刪掉欄位', () => {
    const r = applyOps(seoul2026, [
      { op: 'update_item', date: day2, title: 'MISS 豬腳宵夜', changes: { time: '12:00', verify: null } },
    ])
    expect(r.errors).toEqual([])
    const item = r.trip.days[1].items.find((i) => i.title === 'MISS 豬腳宵夜')!
    expect(item.time).toBe('12:00')
    expect(item).not.toHaveProperty('verify')
    expect(titles(r.trip, day2).indexOf('MISS 豬腳宵夜')).toBeLessThan(titles(r.trip, day2).indexOf('午餐・回住宿放戰利品'))
  })

  it('找不到項目、日期不在旅程內、routeId 不存在都會回報錯誤', () => {
    expect(applyOps(seoul2026, [{ op: 'remove_item', date: day2, title: '不存在' }]).errors[0]).toContain('找不到')
    expect(applyOps(seoul2026, [{ op: 'add_item', date: '2026-12-01', item: { kind: 'food', title: 'x' } }]).errors[0]).toContain(
      '沒有 2026-12-01',
    )
    const bad = applyOps(seoul2026, [{ op: 'add_item', date: day2, item: { time: '10:30', kind: 'transit', title: 'x', routeId: 'nope' } }])
    expect(bad.errors.join()).toContain('nope')
  })

  it('同名項目要用 time 區分', () => {
    const twice = applyOps(seoul2026, [{ op: 'add_item', date: day2, item: { time: '23:00', kind: 'task', title: '散場會合' } }]).trip
    expect(applyOps(twice, [{ op: 'remove_item', date: day2, title: '散場會合' }]).errors[0]).toContain('請加上 time')
    expect(applyOps(twice, [{ op: 'remove_item', date: day2, title: '散場會合', time: '23:00' }]).errors).toEqual([])
  })

  it('清單與「還缺的資料」', () => {
    const r = applyOps(seoul2026, [
      { op: 'add_checklist_item', group: '隨身物品', label: '暖暖包' },
      { op: 'remove_pending', text: seoul2026.pending![0] },
    ])
    expect(r.errors).toEqual([])
    expect(r.trip.checklist[2].items.at(-1)!.label).toBe('暖暖包')
    expect(r.trip.pending).toHaveLength(seoul2026.pending!.length - 1)
  })
})

describe('opsSchema', () => {
  it('擋掉格式錯誤的動作', () => {
    expect(opsSchema.safeParse([{ op: 'add_item', date: '11/7', item: { kind: 'food', title: 'x' } }]).success).toBe(false)
    expect(opsSchema.safeParse([{ op: 'delete_everything' }]).success).toBe(false)
    expect(opsSchema.safeParse([]).success).toBe(false)
  })
})
