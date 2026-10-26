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
    // 11:00 排在 12:00 的午餐之前
    expect(list.indexOf('午餐・韓牛燒肉「朝鮮火爐烤肉」')).toBeGreaterThan(-1)
    expect(list.indexOf('延南洞咖啡廳')).toBe(list.indexOf('午餐・韓牛燒肉「朝鮮火爐烤肉」') - 1)
    expect(r.changes).toEqual([{ kind: 'add', text: '11/7 11:00「延南洞咖啡廳」', date: '2026-11-07' }])
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
    const list = titles(r.trip, day2)
    expect(list.indexOf('MUSINSA KICKS 弘大：逛鞋子')).toBeGreaterThan(-1)
    expect(list.indexOf('MISS 豬腳宵夜')).toBeLessThan(list.indexOf('MUSINSA KICKS 弘大：逛鞋子'))
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

describe('地點清單', () => {
  const pocket = { place: { name: '測試咖啡', local: '테스트 카페' }, category: 'cafe' as const, area: '延南洞' }

  it('加進地點清單：自動產生 id，之後新增同名地點的行程會自動連結', () => {
    const r = applyOps(seoul2026, [
      { op: 'add_spot', spot: pocket },
      { op: 'add_item', date: day2, item: { time: '11:00', kind: 'food', title: '喝咖啡', place: { name: '測試咖啡' } } },
    ])
    expect(r.errors).toEqual([])
    const spot = r.trip.spots!.at(-1)!
    // 名稱沒有英數字時用 spot 當 id
    expect(spot.id).toBe('spot')
    expect(r.trip.days[1].items.find((i) => i.title === '喝咖啡')!.spotId).toBe(spot.id)
    expect(r.changes[0]).toEqual({ kind: 'add', text: '地點清單：測試咖啡' })
  })

  it('同名地點不能重複加；id 不會撞到既有的', () => {
    expect(applyOps(seoul2026, [{ op: 'add_spot', spot: { ...pocket, place: { name: 'MISS 豬腳 弘大店' } } }]).errors[0]).toContain('已經有')
    const r = applyOps(seoul2026, [
      { op: 'add_spot', spot: { ...pocket, place: { name: 'abc' } } },
      { op: 'add_spot', spot: { ...pocket, place: { name: 'ABC!' } } },
    ])
    expect(r.trip.spots!.slice(-2).map((s) => s.id)).toEqual(['abc', 'abc-2'])
  })

  it('用名稱或韓文名找地點來修改；null 代表刪掉欄位', () => {
    const r = applyOps(seoul2026, [
      {
        op: 'update_spot',
        ref: '미쓰족발 홍대',
        spotChanges: { hours: '12:30–24:00', open: [{ days: [6], from: '12:30', to: '24:00' }], checkedAt: '2026-10-27', verify: null },
      },
    ])
    expect(r.errors).toEqual([])
    const spot = r.trip.spots!.find((s) => s.id === 'miss-jokbal')!
    expect(spot).toMatchObject({ hours: '12:30–24:00', checkedAt: '2026-10-27' })
    expect(spot.verify).toBeUndefined()
    expect(r.changes[0].text).toBe('地點清單：MISS 豬腳 弘大店：營業時間、營業時段、確認日期、待確認')
  })

  it('還排在行程裡的地點不能直接刪；口袋名單可以', () => {
    expect(applyOps(seoul2026, [{ op: 'remove_spot', ref: 'miss-jokbal' }]).errors[0]).toContain('還排在行程裡')
    const r = applyOps(seoul2026, [{ op: 'remove_spot', ref: '一片里肌 弘大總店' }])
    expect(r.errors).toEqual([])
    expect(r.trip.spots!.some((s) => s.id === 'ilpyeon-deungsim')).toBe(false)
  })

  it('行程項目指到不存在的地點會被擋下', () => {
    const r = applyOps(seoul2026, [{ op: 'update_item', date: day2, title: 'MISS 豬腳宵夜', changes: { spotId: 'nope' } }])
    expect(r.errors.join()).toContain('不在地點清單裡')
  })

  it('格式檢查接受地點動作', () => {
    expect(opsSchema.safeParse([{ op: 'add_spot', spot: pocket }, { op: 'remove_spot', ref: 'x' }]).success).toBe(true)
    expect(opsSchema.safeParse([{ op: 'add_spot', spot: { place: { name: 'x' }, category: 'bar' } }]).success).toBe(false)
  })
})
