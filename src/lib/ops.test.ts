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
        ref: '미쓰족발 홍대본점',
        spotChanges: { hours: '12:30–24:00', open: [{ days: [6], from: '12:30', to: '24:00' }], checkedAt: '2026-10-27', verify: null },
      },
    ])
    expect(r.errors).toEqual([])
    const spot = r.trip.spots!.find((s) => s.id === 'miss-jokbal')!
    expect(spot).toMatchObject({ hours: '12:30–24:00', checkedAt: '2026-10-27' })
    expect(spot.verify).toBeUndefined()
    expect(r.changes[0].text).toBe('地點清單：MISS 豬腳 弘大店：營業時間、營業時段、確認日期、待確認')
  })

  it('還排在行程裡、或被備案用到的地點不能直接刪；沒人用的口袋名單可以', () => {
    expect(applyOps(seoul2026, [{ op: 'remove_spot', ref: 'miss-jokbal' }]).errors[0]).toContain('還排在行程裡')
    const backup = applyOps(seoul2026, [
      { op: 'add_alternative', date: day2, title: 'MISS 豬腳宵夜', alternative: { trigger: 'closed', title: '改喝咖啡', spotId: 'mega-coffee' } },
      { op: 'remove_spot', ref: 'MEGA COFFEE 弘大入口站店' },
    ])
    expect(backup.errors[0]).toContain('是其他項目的備案')
    const r = applyOps(seoul2026, [
      { op: 'add_spot', spot: pocket },
      { op: 'remove_spot', ref: '測試咖啡' },
    ])
    expect(r.errors).toEqual([])
    expect(r.trip.spots!.some((s) => s.place.name === '測試咖啡')).toBe(false)
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

describe('備案', () => {
  const jokbal = { date: day2, title: 'MISS 豬腳宵夜' }
  const item = (trip: typeof seoul2026, title: string) => trip.days[1].items.find((i) => i.title === title)!
  // 從 MISS 豬腳沒有備案的行程開始，備案編號才固定
  const bare = structuredClone(seoul2026)
  delete bare.days[1].items.find((i) => i.title === 'MISS 豬腳宵夜')!.alternatives
  const withAlts = () =>
    applyOps(bare, [
      { op: 'add_alternative', ...jokbal, alternative: { trigger: 'full', title: '外帶回住宿吃', note: '問「포장 돼요?」' } },
      { op: 'add_alternative', ...jokbal, alternative: { trigger: 'closed', title: '改去 MEGA COFFEE', time: '21:00', spotId: 'mega-coffee' } },
    ])

  it('加備案會記在項目上，修改紀錄寫出觸發條件', () => {
    const r = withAlts()
    expect(r.errors).toEqual([])
    expect(item(r.trip, 'MISS 豬腳宵夜').alternatives).toHaveLength(2)
    expect(r.changes[0].text).toBe('11/7 21:30「MISS 豬腳宵夜」 的備案（客滿）：外帶回住宿吃')
  })

  it('啟用備案：沒寫時間就沿用，原本的安排變成可以換回來的備案', () => {
    const base = withAlts().trip
    const r = applyOps(base, [{ op: 'use_alternative', ...jokbal, index: 0 }])
    expect(r.errors).toEqual([])
    const now = item(r.trip, '外帶回住宿吃')
    expect(now).toMatchObject({ time: '21:30', kind: 'food', note: '問「포장 돼요?」', usedAlternative: { trigger: 'full' } })
    expect(now.place).toBeUndefined()
    expect(now.spotId).toBeUndefined()
    expect(now.verify).toBeUndefined()
    expect(now.alternatives![0]).toMatchObject({ original: true, title: 'MISS 豬腳宵夜', spotId: 'miss-jokbal', time: '21:30' })
    expect(r.changes[0].text).toBe('11/7 21:30「MISS 豬腳宵夜」 改用備案（客滿）：「外帶回住宿吃」')
  })

  it('換過去再換回來，內容與原本一模一樣（除了被拿掉的待確認）', () => {
    const base = withAlts().trip
    const there = applyOps(base, [{ op: 'use_alternative', ...jokbal, index: 0 }]).trip
    const back = applyOps(there, [{ op: 'use_alternative', date: day2, title: '外帶回住宿吃', index: 0 }])
    expect(back.errors).toEqual([])
    const { verify: _verify, alternatives: _alts, ...original } = item(base, 'MISS 豬腳宵夜')
    const { alternatives: altsBack, ...restored } = item(back.trip, 'MISS 豬腳宵夜')
    expect(restored).toEqual(original)
    expect(altsBack).toEqual(item(base, 'MISS 豬腳宵夜').alternatives)
    expect(back.changes[0].text).toContain('換回原本的安排')
  })

  it('沒寫時間的備案一直沿用目前的時間：換回來、改時間、再換過去，用的是新時間', () => {
    const base = withAlts().trip
    const there = applyOps(base, [{ op: 'use_alternative', ...jokbal, index: 0 }]).trip
    const back = applyOps(there, [{ op: 'use_alternative', date: day2, title: '外帶回住宿吃', index: 0 }]).trip
    expect(item(back, 'MISS 豬腳宵夜').alternatives![0]).not.toHaveProperty('time')
    const moved = applyOps(back, [{ op: 'update_item', ...jokbal, changes: { time: '22:00' } }]).trip
    const again = applyOps(moved, [{ op: 'use_alternative', ...jokbal, index: 0 }])
    expect(again.errors).toEqual([])
    expect(item(again.trip, '外帶回住宿吃').time).toBe('22:00')
  })

  it('從一個備案直接換到另一個：前一個備案保留自己的觸發條件；有指定時間就重新排序', () => {
    const base = withAlts().trip
    const a = applyOps(base, [{ op: 'use_alternative', ...jokbal, index: 0 }]).trip
    const b = applyOps(a, [{ op: 'use_alternative', date: day2, title: '外帶回住宿吃', index: 1 }])
    expect(b.errors).toEqual([])
    const now = item(b.trip, '改去 MEGA COFFEE')
    expect(now).toMatchObject({ time: '21:00', spotId: 'mega-coffee', usedAlternative: { trigger: 'closed' } })
    expect(now.alternatives!.map((x) => [x.title, x.trigger, x.original ?? false])).toEqual([
      ['MISS 豬腳宵夜', 'other', true],
      ['外帶回住宿吃', 'full', false],
    ])
    const list = titles(b.trip, day2)
    expect(list.indexOf('改去 MEGA COFFEE')).toBeLessThan(list.indexOf('一起搭地鐵回弘大') + 2)
  })

  it('刪除備案；原本的安排不能刪；編號不存在會回報', () => {
    const base = withAlts().trip
    const r = applyOps(base, [{ op: 'remove_alternative', ...jokbal, index: 1 }])
    expect(item(r.trip, 'MISS 豬腳宵夜').alternatives!.map((a) => a.title)).toEqual(['外帶回住宿吃'])
    const there = applyOps(base, [{ op: 'use_alternative', ...jokbal, index: 0 }]).trip
    expect(applyOps(there, [{ op: 'remove_alternative', date: day2, title: '外帶回住宿吃', index: 0 }]).errors[0]).toContain('不能刪')
    expect(applyOps(base, [{ op: 'use_alternative', ...jokbal, index: 5 }]).errors[0]).toContain('沒有第 6 個備案')
  })

  it('備案指到不存在的地點會被擋下', () => {
    const r = applyOps(seoul2026, [{ op: 'add_alternative', ...jokbal, alternative: { trigger: 'rain', title: 'x', spotId: 'nope' } }])
    expect(r.errors.join()).toContain('不在地點清單裡')
  })
})
