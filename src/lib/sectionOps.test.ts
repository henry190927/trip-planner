import { describe, expect, it } from 'vitest'
import { opsSchema } from '../schema'
import { seoul2026 } from '../../test/fixtures/seoul-2026-11'
import { applyOps, type Op } from './ops'

const apply = (ops: Op[]) => applyOps(seoul2026, opsSchema.parse(ops))

const flight = {
  label: '去程',
  date: '2026-11-06',
  airline: '測試航空',
  number: 'TS123',
  duration: '2 小時 30 分',
  from: { code: 'TPE', name: '桃園', terminal: 'T2', time: '08:00', tzLabel: '台灣' },
  to: { code: 'ICN', name: '仁川', terminal: 'T1', time: '11:30', tzLabel: '韓國' },
}

describe('行程基本資料與日期', () => {
  it('改名稱、時區、地圖 App；null 刪掉欄位', () => {
    const r = apply([{ op: 'update_trip', tripChanges: { title: '首爾小旅行', mapProvider: 'kakao', driverPhrase: null } }])
    expect(r.errors).toEqual([])
    expect(r.trip).toMatchObject({ title: '首爾小旅行', mapProvider: 'kakao' })
    expect(r.trip.driverPhrase).toBeUndefined()
    expect(r.changes[0].text).toBe('行程：名稱、地圖 App、給司機看的那句話')
  })

  it('時區寫錯會被擋下', () => {
    expect(apply([{ op: 'update_trip', tripChanges: { timezone: 'Seoul' } }]).errors.join()).toContain('時區')
  })

  it('延長日期：多出來的日子補成空白的一天，原本的安排不動', () => {
    const r = apply([{ op: 'set_dates', startDate: '2026-11-05', endDate: '2026-11-09' }])
    expect(r.errors).toEqual([])
    expect(r.trip.days.map((d) => d.date)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'])
    expect(r.trip.days[0]).toMatchObject({ items: [], scene: 'depart' })
    expect(r.trip.days[1].items).toEqual(seoul2026.days[0].items)
    expect(r.trip).toMatchObject({ startDate: '2026-11-05', endDate: '2026-11-09' })
  })

  it('縮短日期時，被拿掉的日子還有安排就拒絕', () => {
    const r = apply([{ op: 'set_dates', startDate: '2026-11-06', endDate: '2026-11-07' }])
    expect(r.errors[0]).toContain('還有安排')
  })

  it('改某一天的標題與插圖', () => {
    const r = apply([{ op: 'update_day', date: '2026-11-07', dayChanges: { title: '慢慢逛', scene: 'stroll' } }])
    expect(r.errors).toEqual([])
    expect(r.trip.days[1]).toMatchObject({ title: '慢慢逛', scene: 'stroll' })
  })
})

describe('旅伴', () => {
  it('新增時自動給 id 與顏色；同名拒絕', () => {
    const r = apply([{ op: 'add_traveler', traveler: { name: 'Amy' } }])
    expect(r.errors).toEqual([])
    expect(r.trip.travelers.at(-1)).toMatchObject({ id: 'amy', name: 'Amy' })
    expect(r.trip.travelers.at(-1)!.color).toMatch(/^#/)
    expect(apply([{ op: 'add_traveler', traveler: { name: seoul2026.travelers[0].name } }]).errors[0]).toContain('已經有')
  })

  it('還有項目指定給他時不能刪', () => {
    const someone = seoul2026.days.flatMap((d) => d.items).find((i) => i.who?.length)!.who![0]
    expect(apply([{ op: 'remove_traveler', ref: someone }]).errors[0]).toContain('還在這些項目裡')
  })
})

describe('班機', () => {
  it('新增、只改起飛時間（其他沿用）、刪除', () => {
    const added = apply([{ op: 'add_flight', flight }])
    expect(added.errors).toEqual([])
    expect(added.trip.flights.find((f) => f.number === 'TS123')).toMatchObject(flight)
    expect(added.changes[0].text).toBe('班機：TS123（TPE → ICN）')

    const moved = applyOps(added.trip, [{ op: 'update_flight', ref: 'TS123', flightChanges: { from: { time: '09:40' } } }])
    expect(moved.errors).toEqual([])
    expect(moved.trip.flights.find((f) => f.number === 'TS123')!.from).toEqual({ ...flight.from, time: '09:40' })
    expect(moved.changes[0].text).toBe('班機：TS123（TPE → ICN）：出發')

    const removed = applyOps(added.trip, [{ op: 'remove_flight', ref: 'TS123' }])
    expect(removed.trip.flights.some((f) => f.number === 'TS123')).toBe(false)
  })

  it('同一天同一班不能重複加；找不到的班機回報', () => {
    const added = apply([{ op: 'add_flight', flight }])
    expect(applyOps(added.trip, [{ op: 'add_flight', flight }]).errors[0]).toContain('已經有')
    expect(apply([{ op: 'update_flight', ref: 'NOPE', flightChanges: { duration: '1h' } }]).errors[0]).toContain('找不到班機')
  })
})

describe('住宿', () => {
  it('新增；改地址時只給一部分，名稱沿用', () => {
    const stay = { place: { name: '海邊民宿', address: '1 Beach-ro' }, checkIn: '12/22 15:00', checkOut: '12/26 11:00' }
    const added = apply([{ op: 'add_stay', stay }])
    expect(added.errors).toEqual([])
    const r = applyOps(added.trip, [{ op: 'update_stay', ref: '海邊民宿', stayChanges: { place: { address: '2 Beach-ro' }, notes: ['訂位代號 ABC123'] } }])
    expect(r.errors).toEqual([])
    expect(r.trip.stays.find((s) => s.place.name === '海邊民宿')).toMatchObject({ place: { name: '海邊民宿', address: '2 Beach-ro' }, notes: ['訂位代號 ABC123'] })
  })
})

describe('交通', () => {
  const route = {
    title: '機場到住宿',
    summary: '搭機場線',
    options: [{ label: '機場線', mode: '地鐵', recommended: true, duration: '50 分', cost: '₩4,000', steps: ['搭機場線到市區'] }],
  }

  it('新增時從標題產生 id；推薦方案要剛好一個', () => {
    const r = apply([{ op: 'add_route', route: { ...route, id: 'airport-stay' } }])
    expect(r.errors).toEqual([])
    expect(r.trip.routes.at(-1)!.id).toBe('airport-stay')
    const none = apply([{ op: 'add_route', route: { ...route, options: [{ ...route.options[0], recommended: false }] } }])
    expect(none.errors.join()).toContain('推薦方案')
  })

  it('還連在行程項目上的路線不能刪', () => {
    const used = seoul2026.days.flatMap((d) => d.items).find((i) => i.routeId)!.routeId!
    expect(apply([{ op: 'remove_route', ref: used }]).errors[0]).toContain('還連在這些項目上')
  })
})

describe('資訊與清單分組', () => {
  it('小提醒：分組不存在時自動建立；刪到空就拿掉分組', () => {
    const added = apply([{ op: 'add_tip', section: '慶生', tip: { title: '蛋糕', body: ['前一天取'] } }])
    expect(added.errors).toEqual([])
    expect(added.trip.tips.at(-1)).toEqual({ title: '慶生', tips: [{ title: '蛋糕', body: ['前一天取'] }] })
    const edited = applyOps(added.trip, [{ op: 'update_tip', ref: '蛋糕', tipChanges: { level: 'warn' } }])
    expect(edited.trip.tips.at(-1)!.tips[0].level).toBe('warn')
    const removed = applyOps(added.trip, [{ op: 'remove_tip', ref: '蛋糕', section: '慶生' }])
    expect(removed.trip.tips.some((s) => s.title === '慶生')).toBe(false)
  })

  it('清單分組：新增、改名、刪除', () => {
    const added = apply([{ op: 'add_checklist_group', title: '慶生' }])
    expect(added.trip.checklist.at(-1)).toEqual({ title: '慶生', items: [] })
    const renamed = applyOps(added.trip, [{ op: 'update_checklist_group', ref: '慶生', title: '生日驚喜' }])
    expect(renamed.trip.checklist.at(-1)!.title).toBe('生日驚喜')
    const removed = applyOps(renamed.trip, [{ op: 'remove_checklist_group', ref: '生日驚喜' }])
    expect(removed.trip.checklist.some((g) => g.title === '生日驚喜')).toBe(false)
    expect(apply([{ op: 'add_checklist_group', title: seoul2026.checklist[0].title }]).errors[0]).toContain('已經有')
  })
})

it('一次最多 40 個動作', () => {
  const many = Array.from({ length: 41 }, () => ({ op: 'add_pending', text: 'x' }))
  expect(opsSchema.safeParse(many).success).toBe(false)
  expect(opsSchema.safeParse(many.slice(0, 40)).success).toBe(true)
})

describe('建立新行程時模型送來的順序', () => {
  it('先改某一天才設定日期、清單項目寫在分組前面：一樣套得上', async () => {
    const { blankTrip } = await import('./sectionOps')
    const r = applyOps(
      blankTrip(['我', '她'], '2026-11-21'),
      opsSchema.parse([
        { op: 'update_day', date: '2026-12-23', dayChanges: { title: '海雲台' } },
        { op: 'add_checklist_item', group: '證件與錢', label: '護照' },
        { op: 'update_trip', tripChanges: { title: '釜山', timezone: 'Asia/Seoul', mapProvider: 'naver' } },
        { op: 'set_dates', startDate: '2026-12-22', endDate: '2026-12-26' },
        { op: 'add_checklist_group', title: '證件與錢' },
        { op: 'add_checklist_group', title: 'App 與網路' },
        { op: 'add_checklist_item', group: 'App 與網路', label: 'Naver Map' },
      ]),
    )
    expect(r.errors).toEqual([])
    expect(r.trip.days.find((d) => d.date === '2026-12-23')!.title).toBe('海雲台')
    expect(r.trip.checklist.map((g) => g.items.map((i) => i.label))).toEqual([['護照'], ['Naver Map']])
  })

  it('同一次在不同分組各加清單項目，id 不會重複', () => {
    const r = apply([
      { op: 'add_checklist_group', title: 'A' },
      { op: 'add_checklist_group', title: 'B' },
      { op: 'add_checklist_item', group: 'A', label: '一' },
      { op: 'add_checklist_item', group: 'B', label: '二' },
      { op: 'add_checklist_item', group: 'B', label: '三' },
    ])
    expect(r.errors).toEqual([])
  })
})

it('加清單項目時分組不存在就自動建立', () => {
  const r = apply([
    { op: 'add_checklist_item', group: '慶生', label: '蛋糕' },
    { op: 'add_checklist_item', group: '慶生', label: '卡片' },
  ])
  expect(r.errors).toEqual([])
  expect(r.trip.checklist.at(-1)).toMatchObject({ title: '慶生', items: [{ label: '蛋糕' }, { label: '卡片' }] })
  expect(r.changes.map((c) => c.text)).toEqual(['清單分組：慶生', '清單「慶生」：蛋糕', '清單「慶生」：卡片'])
})
