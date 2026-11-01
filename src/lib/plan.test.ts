import { describe, expect, it } from 'vitest'
import { seoul2026 } from '../trips/seoul-2026-11'
import { applyOps } from './ops'
import { freeWindows, isFixed, makeRoom, shiftItems } from './plan'

const day = (date: string) => structuredClone(seoul2026.days.find((d) => d.date === date)!)
const at = (d: ReturnType<typeof day>, title: string) => d.items.find((i) => i.title === title)!

describe('isFixed', () => {
  it('班機、演唱會預設固定；有標 fixed 的照標的', () => {
    const d = day('2026-11-07')
    expect(isFixed(at(d, '第二場・南優鉉《식목일VI – EVER GREEN》'))).toBe(true)
    expect(isFixed(at(d, '取票・周邊（想再逛可以去）'))).toBe(true)
    expect(isFixed(at(d, 'MISS 豬腳宵夜'))).toBe(false)
  })
})

describe('freeWindows', () => {
  it('她 11/7：取票、演唱會、散場會合把一天切成幾段', () => {
    const w = freeWindows(day('2026-11-07'), { who: 'her' })
    expect(w.map((x) => [x.from, x.to, x.minutes])).toEqual([
      ['00:00', '16:15', 975],
      ['16:15', '18:00', 105],
      ['18:00', '20:30', 150],
      ['20:30', null, null],
    ])
    expect(w[0].flexible).toContain('15:30「弘大 → KBS Arena」')
  })

  it('我 11/7：她的演唱會不算我的固定行程；after 從現在開始算', () => {
    const w = freeWindows(day('2026-11-07'), { who: 'me', after: '15:00' })
    expect(w[0]).toMatchObject({ from: '15:00', fromLabel: '現在', to: '20:30', minutes: 330 })
    expect(w[0].flexible).toEqual(['15:00「逛 STAND OIL 弘大旗艦店」', '15:30「自由時間：京義線林蔭道・望遠市場」', '19:45「出發去 KBS Arena 接她」'])
  })
})

describe('shiftItems', () => {
  it('往後延會撞到固定行程就整個不挪，並說明撞到哪個', () => {
    const d = day('2026-11-08')
    const r = shiftItems(d, '06:45', 30)
    expect(r.moved).toBe(0)
    expect(r.errors.join()).toContain('撞到固定行程 08:40「濟州航空報到・退稅・出境」')
    expect(at(d, '起床・整理・退房').time).toBe('06:45')
  })

  it('只挪某位旅伴自己的彈性項目，全員一起的與固定的不動，結束時間一起挪', () => {
    const d = day('2026-11-07')
    const r = shiftItems(d, '15:30', 5, { who: 'me' })
    // 挪到下一個跟我有關的固定行程（兩個人的散場會合）之前
    expect(r).toEqual({ moved: 2, until: '20:30', errors: [] })
    expect(at(d, '自由時間：京義線林蔭道・望遠市場').time).toBe('15:35')
    expect(at(d, '出發去 KBS Arena 接她')).toMatchObject({ time: '19:50', end: '20:30' })
    expect(at(d, '散場會合').time).toBe('20:30')
    expect(at(d, '弘大 → KBS Arena').time).toBe('15:30')
    expect(at(d, '一起搭地鐵回弘大').time).toBe('20:40')
  })

  it('預設只挪到下一個固定行程之前，後面的不受影響', () => {
    const d = day('2026-11-07')
    const r = shiftItems(d, '12:00', -30)
    expect(r).toMatchObject({ until: '16:15', errors: [] })
    expect(at(d, '午餐・韓牛燒肉「朝鮮火爐烤肉」').time).toBe('11:30')
    expect(at(d, 'MISS 豬腳宵夜').time).toBe('21:30')
  })

  it('她的取票擋不到我；但會擋她自己的移動', () => {
    // 我往後 10 分：接她的路程會撞到 20:30 的散場會合（那是我們兩個的）
    expect(shiftItems(day('2026-11-07'), '14:45', 10, { who: 'me' }).errors.join()).toContain('散場會合')
    expect(shiftItems(day('2026-11-07'), '14:45', 5, { who: 'me' }).errors).toEqual([])
    expect(shiftItems(day('2026-11-07'), '14:45', 10, { who: 'her' }).errors.join()).toContain('取票・周邊（想再逛可以去）')
  })

  it('往前提不能早於前面固定行程的結束；跨時區的項目不動', () => {
    expect(shiftItems(day('2026-11-07'), '20:40', -20).errors.join()).toContain('早於固定行程「散場會合」')
    expect(shiftItems(day('2026-11-07'), '12:00', -30, { until: '23:59' }).errors.join()).toContain('早於固定行程「散場會合」')
    const d1 = day('2026-11-06')
    shiftItems(d1, '00:00', -5)
    expect(at(d1, '抵達桃園機場 T1').time).toBe('10:15')
  })
})

describe('shift_items 動作', () => {
  it('透過 applyOps 挪時間，修改紀錄寫出挪了多少', () => {
    const r = applyOps(seoul2026, [{ op: 'shift_items', date: '2026-11-07', from: '12:00', minutes: -30 }])
    expect(r.errors).toEqual([])
    expect(r.trip.days[1].items[0]).toMatchObject({ time: '11:30', title: '午餐・韓牛燒肉「朝鮮火爐烤肉」' })
    expect(r.changes[0].text).toBe('11/7 12:00–16:15 的彈性行程提前 30 分（7 項）')
  })

  it('沒有東西可以挪、或撞到固定行程時回報錯誤', () => {
    expect(applyOps(seoul2026, [{ op: 'shift_items', date: '2026-11-08', from: '11:00', minutes: 10 }]).errors[0]).toContain('沒有可以挪')
    expect(applyOps(seoul2026, [{ op: 'shift_items', date: '2026-11-08', from: '06:45', minutes: 30 }]).errors[0]).toContain('撞到固定行程')
  })
})

describe('makeRoom（insert_item）', () => {
  const ids = ['her', 'me']
  const insert = (item: Parameters<typeof makeRoom>[1]) => {
    const d = day('2026-11-07')
    return { d, room: makeRoom(d, item, ids) }
  }

  it('只推被蓋到的；中間有空檔就吸收，不會動到晚上的行程', () => {
    const { d, room } = insert({ time: '15:30', end: '16:00', kind: 'shopping', title: '逛書店', who: ['me'] })
    expect(room.errors).toEqual([])
    expect(room.moved).toEqual([{ title: '自由時間：京義線林蔭道・望遠市場', from: '15:30', to: '16:00', private: undefined }])
    expect(at(d, '出發去 KBS Arena 接她').time).toBe('19:45')
    expect(at(d, '弘大 → KBS Arena').time).toBe('15:30')
  })

  it('兩個人一起的項目，被推的時候各走各的線：她的車程不會把我的自由時間也推後', () => {
    // 15:00 STAND OIL 前面插 30 分鐘兩人一起的行程：STAND OIL 推到 15:30，她出發推到 16:00、我自由時間也只推到 16:00
    const { d, room } = insert({ time: '15:00', end: '15:30', kind: 'shopping', title: '逛 SPAO' })
    expect(room.errors.join()).toContain('取票')
    // 她 16:00 出發要 16:45 才到，會撞到 16:15 取票：整批不動
    expect(at(d, '逛 STAND OIL 弘大旗艦店').time).toBe('15:00')
  })

  it('推的範圍剛好卡在固定行程之前就可以', () => {
    const { d, room } = insert({ time: '14:30', end: '14:45', kind: 'food', title: '買飲料' })
    // EPT 14:30–15:00 → 14:45–15:15、STAND OIL 15:00–15:30 → 15:15–15:45、她出發 15:30 → 15:45–16:30 會撞 16:15 取票
    expect(room.errors.join()).toContain('取票')
    expect(at(d, '逛鞋店 EPT 弘大店').time).toBe('14:30')
  })

  it('取票改到 17:00 之後，插入就推得動；我的自由時間跟著她出發的時間但不被她的車程拖住', () => {
    const d = day('2026-11-07')
    at(d, '取票・周邊（想再逛可以去）').time = '17:00'
    const room = makeRoom(d, { time: '15:00', end: '15:30', kind: 'shopping', title: '逛 SPAO' }, ids)
    expect(room.errors).toEqual([])
    expect(Object.fromEntries(room.moved.map((m) => [m.title, `${m.from}→${m.to}`]))).toEqual({
      '逛 STAND OIL 弘大旗艦店': '15:00→15:30',
      '弘大 → KBS Arena': '15:30→16:00',
      '自由時間：京義線林蔭道・望遠市場': '15:30→16:00',
    })
    expect(at(d, '弘大 → KBS Arena').end).toBe('16:45')
  })
})
