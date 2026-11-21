import type { z } from 'zod'
import type { sectionOpSchemas } from '../schema'
import type { Day, Flight, Route, Stay, Tip, Traveler, Trip } from '../types'
import { formatDate } from './dates'
import type { Change } from './ops'

// 行程裡「每天的項目」以外的區塊：基本資料、天數、旅伴、班機、住宿、交通、資訊、清單分組。
// 每種都是「新增／修改／刪除」，改完由 applyOps 整份重新驗證。

export type SectionOp = z.infer<(typeof sectionOpSchemas)[number]>

/** 旅伴的預設配色（淺色底、文字色），依加入順序輪流用 */
const travelerColors = [
  { color: '#FFCCB8', ink: '#a8432a' },
  { color: '#97D7FF', ink: '#1f5f8b' },
  { color: '#FFE8C4', ink: '#8a5a1c' },
  { color: '#CDEBC0', ink: '#3f6b2f' },
  { color: '#E4D4F4', ink: '#5b3f86' },
]

const fieldNames: Record<string, string> = {
  title: '名稱',
  subtitle: '副標題',
  icon: '插圖',
  timezone: '時區',
  mapProvider: '地圖 App',
  driverPhrase: '給司機看的那句話',
  scene: '插圖',
  name: '名字',
  color: '顏色',
  ink: '顏色',
  label: '標籤',
  date: '日期',
  airline: '航空公司',
  number: '航班號碼',
  aircraft: '機型',
  cabin: '艙等',
  duration: '飛行時間',
  from: '出發',
  to: '抵達',
  notes: '備註',
  place: '名稱與地址',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  verify: '待確認',
  who: '誰',
  when: '時間',
  summary: '說明',
  options: '方案',
  fallback: '備案',
  body: '內容',
  level: '重要程度',
  links: '連結',
}

const fieldList = (changes: object) => [...new Set(Object.keys(changes).map((k) => fieldNames[k] ?? k))].join('、')

/** 套用「要改的欄位」：值是 null 代表刪掉那個欄位；merge 裡的欄位只給一部分時跟原本的合併 */
function patch(target: Record<string, unknown>, changes: object, merge: string[] = []) {
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue
    if (value === null) delete target[key]
    else if (merge.includes(key)) target[key] = { ...(target[key] as object), ...(value as object) }
    else target[key] = value
  }
}

/** 從名稱產生不重複的 id（只留英數；中文名稱就用 prefix 加流水號） */
function idFor(name: string, taken: Set<string>, prefix: string) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || prefix
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}

function datesBetween(start: string, end: string) {
  const out: string[] = []
  const first = Date.parse(`${start}T00:00:00Z`)
  for (let i = 0; i < 61; i++) {
    const date = new Date(first + i * 86_400_000).toISOString().slice(0, 10)
    if (date > end) break
    out.push(date)
  }
  return out
}

/** 新的一天：第一天是出發、最後一天是回家，其他是散步 */
export function blankDay(date: string, index: number, total: number): Day {
  const scene = index === 0 ? 'depart' : index === total - 1 ? 'home' : 'stroll'
  return { date, title: index === 0 ? '出發' : index === total - 1 ? '回家' : `第 ${index + 1} 天`, scene, items: [] }
}

/** 新行程的空白草稿：小樹用一般的修改動作把它填好，按「套用」時才真的建立 */
export function blankTrip(travelerNames: string[], today: string): Trip {
  const names = travelerNames.length ? travelerNames : ['我']
  const taken = new Set<string>()
  const travelers = names.map((name, i) => {
    const id = idFor(name, taken, `traveler-${i + 1}`)
    taken.add(id)
    return { id, name, ...travelerColors[i % travelerColors.length] }
  })
  return {
    id: 'new-trip',
    title: '新行程',
    subtitle: '',
    timezone: 'Asia/Taipei',
    startDate: today,
    endDate: today,
    mapProvider: 'google',
    travelers,
    flights: [],
    stays: [],
    days: [blankDay(today, 0, 1)],
    routes: [],
    tips: [],
    checklist: [],
    spots: [],
  }
}

/** 新行程的 id：用小樹給的英文 id（例如 busan-2026-12），不能用或重複時改用日期 */
export function newTripId(wanted: unknown, startDate: string, taken: string[]) {
  const ok = typeof wanted === 'string' && /^[a-z0-9][a-z0-9-]{2,39}$/.test(wanted) && wanted !== 'new-trip'
  const base = ok ? wanted : `trip-${startDate.slice(0, 7)}`
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

/** 用文字找一筆；找不到或不只一筆時回傳錯誤訊息 */
function findOne<T>(list: T[], match: (x: T) => boolean, what: string, ref: string): { found: T } | { error: string } {
  const hits = list.filter(match)
  if (hits.length === 0) return { error: `找不到${what}「${ref}」` }
  if (hits.length > 1) return { error: `有 ${hits.length} 個${what}都叫「${ref}」，請說得更明確` }
  return { found: hits[0] }
}

const flightName = (f: Flight) => `${f.number}（${f.from.code} → ${f.to.code}）`

export function applySectionOp(trip: Trip, op: SectionOp, changes: Change[], errors: string[]) {
  const fail = (message: string) => void errors.push(message)

  switch (op.op) {
    case 'update_trip': {
      patch(trip as unknown as Record<string, unknown>, op.tripChanges)
      changes.push({ kind: 'update', text: `行程：${fieldList(op.tripChanges)}` })
      return
    }

    case 'set_dates': {
      if (op.endDate < op.startDate) return fail('結束日期不能比開始日期早')
      const dates = datesBetween(op.startDate, op.endDate)
      if (dates.at(-1) !== op.endDate) return fail('旅程最多 60 天')
      const dropped = trip.days.filter((d) => !dates.includes(d.date) && d.items.length)
      if (dropped.length)
        return fail(`${dropped.map((d) => `${formatDate(d.date, false)}（${d.items.length} 個項目）`).join('、')} 還有安排，要先移到別天或刪掉`)
      const byDate = new Map(trip.days.map((d) => [d.date, d]))
      trip.days = dates.map((date, i) => byDate.get(date) ?? blankDay(date, i, dates.length))
      trip.startDate = op.startDate
      trip.endDate = op.endDate
      changes.push({ kind: 'update', text: `旅程日期：${formatDate(op.startDate, false)} – ${formatDate(op.endDate, false)}` })
      return
    }

    case 'update_day': {
      const day = trip.days.find((d) => d.date === op.date)
      if (!day) return fail(`旅程裡沒有 ${op.date} 這一天`)
      patch(day as unknown as Record<string, unknown>, op.dayChanges)
      changes.push({ kind: 'update', text: `${formatDate(op.date, false)}：${fieldList(op.dayChanges)}`, date: op.date })
      return
    }

    case 'add_traveler': {
      const name = op.traveler.name.trim()
      if (trip.travelers.some((t) => t.name === name)) return fail(`已經有叫「${name}」的旅伴了`)
      const colors = travelerColors[trip.travelers.length % travelerColors.length]
      const traveler: Traveler = {
        ...colors,
        ...op.traveler,
        name,
        id: op.traveler.id ?? idFor(name, new Set(trip.travelers.map((t) => t.id)), 'traveler'),
      }
      if (trip.travelers.some((t) => t.id === traveler.id)) return fail(`旅伴 id「${traveler.id}」重複了`)
      trip.travelers.push(traveler)
      changes.push({ kind: 'add', text: `旅伴：${name}` })
      return
    }

    case 'update_traveler':
    case 'remove_traveler': {
      const hit = findOne(trip.travelers, (t) => t.id === op.ref || t.name === op.ref, '旅伴', op.ref)
      if ('error' in hit) return fail(hit.error)
      const t = hit.found
      if (op.op === 'update_traveler') {
        const before = t.name
        patch(t as unknown as Record<string, unknown>, op.travelerChanges)
        changes.push({ kind: 'update', text: `旅伴：${before}：${fieldList(op.travelerChanges)}` })
        return
      }
      if (trip.travelers.length === 1) return fail('至少要有一位旅伴')
      const used = trip.days.flatMap((d) => d.items.filter((i) => i.who?.includes(t.id)).map((i) => `${formatDate(d.date, false)}「${i.title}」`))
      if (used.length) return fail(`「${t.name}」還在這些項目裡：${used.slice(0, 5).join('、')}${used.length > 5 ? '…' : ''}，要先改掉`)
      trip.travelers = trip.travelers.filter((x) => x !== t)
      changes.push({ kind: 'remove', text: `旅伴：${t.name}` })
      return
    }

    case 'add_flight': {
      if (trip.flights.some((f) => f.number === op.flight.number && f.date === op.flight.date))
        return fail(`${op.flight.date} 已經有 ${op.flight.number} 了，要改內容請用 update_flight`)
      trip.flights.push(op.flight)
      trip.flights.sort((a, b) => (a.date + a.from.time).localeCompare(b.date + b.from.time))
      changes.push({ kind: 'add', text: `班機：${flightName(op.flight)}`, date: op.flight.date })
      return
    }

    case 'update_flight':
    case 'remove_flight': {
      const hit = findOne(trip.flights, (f) => f.number === op.ref || f.label === op.ref, '班機', op.ref)
      if ('error' in hit) return fail(hit.error)
      const f = hit.found
      if (op.op === 'remove_flight') {
        trip.flights = trip.flights.filter((x) => x !== f)
        changes.push({ kind: 'remove', text: `班機：${flightName(f)}` })
        return
      }
      patch(f as unknown as Record<string, unknown>, op.flightChanges, ['from', 'to'])
      trip.flights.sort((a, b) => (a.date + a.from.time).localeCompare(b.date + b.from.time))
      changes.push({ kind: 'update', text: `班機：${flightName(f)}：${fieldList(op.flightChanges)}`, date: f.date })
      return
    }

    case 'add_stay': {
      if (trip.stays.some((s) => s.place.name === op.stay.place.name)) return fail(`已經有「${op.stay.place.name}」了，要改內容請用 update_stay`)
      trip.stays.push(op.stay)
      changes.push({ kind: 'add', text: `住宿：${op.stay.place.name}` })
      return
    }

    case 'update_stay':
    case 'remove_stay': {
      const hit = findOne(trip.stays, (s: Stay) => s.place.name === op.ref || s.place.local === op.ref, '住宿', op.ref)
      if ('error' in hit) return fail(hit.error)
      const s = hit.found
      if (op.op === 'remove_stay') {
        trip.stays = trip.stays.filter((x) => x !== s)
        changes.push({ kind: 'remove', text: `住宿：${s.place.name}` })
        return
      }
      patch(s as unknown as Record<string, unknown>, op.stayChanges, ['place'])
      changes.push({ kind: 'update', text: `住宿：${s.place.name}：${fieldList(op.stayChanges)}` })
      return
    }

    case 'add_route': {
      const taken = new Set(trip.routes.map((r) => r.id))
      if (op.route.id && taken.has(op.route.id)) return fail(`路線 id「${op.route.id}」已經有了，要改內容請用 update_route`)
      if (trip.routes.some((r) => r.title === op.route.title)) return fail(`已經有「${op.route.title}」這條路線了，要改內容請用 update_route`)
      const route: Route = { ...op.route, id: op.route.id ?? idFor(op.route.title, taken, 'route') }
      trip.routes.push(route)
      changes.push({ kind: 'add', text: `交通：${route.title}` })
      return
    }

    case 'update_route':
    case 'remove_route': {
      const hit = findOne(trip.routes, (r) => r.id === op.ref || r.title === op.ref, '路線', op.ref)
      if ('error' in hit) return fail(hit.error)
      const r = hit.found
      if (op.op === 'remove_route') {
        const used = trip.days.flatMap((d) =>
          d.items.filter((i) => i.routeId === r.id || i.alternatives?.some((a) => a.routeId === r.id)).map((i) => `${formatDate(d.date, false)}「${i.title}」`),
        )
        if (used.length) return fail(`「${r.title}」還連在這些項目上：${used.join('、')}，要先改掉`)
        trip.routes = trip.routes.filter((x) => x !== r)
        changes.push({ kind: 'remove', text: `交通：${r.title}` })
        return
      }
      const before = r.title
      patch(r as unknown as Record<string, unknown>, op.routeChanges)
      changes.push({ kind: 'update', text: `交通：${before}：${fieldList(op.routeChanges)}` })
      return
    }

    case 'add_tip': {
      let section = trip.tips.find((s) => s.title === op.section)
      if (!section) {
        section = { title: op.section, tips: [] }
        trip.tips.push(section)
      }
      if (section.tips.some((t) => t.title === op.tip.title)) return fail(`「${op.section}」裡已經有「${op.tip.title}」了，要改內容請用 update_tip`)
      section.tips.push(op.tip)
      changes.push({ kind: 'add', text: `資訊「${op.section}」：${op.tip.title}` })
      return
    }

    case 'update_tip':
    case 'remove_tip': {
      const all = trip.tips.flatMap((section) => (op.section && section.title !== op.section ? [] : section.tips.map((tip) => ({ section, tip }))))
      const hit = findOne(all, (x: { tip: Tip }) => x.tip.title === op.ref, '小提醒', op.ref)
      if ('error' in hit) return fail(hit.error)
      const { section, tip } = hit.found
      if (op.op === 'remove_tip') {
        section.tips = section.tips.filter((x) => x !== tip)
        // 分組空了就一起拿掉
        if (!section.tips.length) trip.tips = trip.tips.filter((x) => x !== section)
        changes.push({ kind: 'remove', text: `資訊「${section.title}」：${tip.title}` })
        return
      }
      const before = tip.title
      patch(tip as unknown as Record<string, unknown>, op.tipChanges)
      changes.push({ kind: 'update', text: `資訊「${section.title}」：${before}：${fieldList(op.tipChanges)}` })
      return
    }

    case 'add_checklist_group': {
      if (trip.checklist.some((g) => g.title === op.title)) return fail(`清單已經有「${op.title}」這一組了`)
      trip.checklist.push({ title: op.title, items: [] })
      changes.push({ kind: 'add', text: `清單分組：${op.title}` })
      return
    }

    case 'update_checklist_group':
    case 'remove_checklist_group': {
      const hit = findOne(trip.checklist, (g) => g.title === op.ref, '清單分組', op.ref)
      if ('error' in hit) return fail(hit.error)
      const g = hit.found
      if (op.op === 'remove_checklist_group') {
        trip.checklist = trip.checklist.filter((x) => x !== g)
        changes.push({ kind: 'remove', text: `清單分組：${g.title}${g.items.length ? `（連同 ${g.items.length} 個項目）` : ''}` })
        return
      }
      if (trip.checklist.some((x) => x !== g && x.title === op.title)) return fail(`清單已經有「${op.title}」這一組了`)
      changes.push({ kind: 'update', text: `清單分組：${g.title} → ${op.title}` })
      g.title = op.title
      return
    }
  }
}
