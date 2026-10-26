import type { z } from 'zod'
import type { opSchema } from '../schema'
import type { Alternative, Day, Item, Spot, Trip } from '../types'
import { triggerLabels } from './triggers'
import { shiftItems } from './plan'
import { formatDate } from './dates'
import { validateTrip } from './validate'

export type Op = z.infer<typeof opSchema>

export interface Change {
  kind: 'add' | 'update' | 'remove'
  text: string
  /** 行程項目的變動才有：是哪一天，通知可以直接跳過去 */
  date?: string
}

export interface ApplyResult {
  trip: Trip
  changes: Change[]
  errors: string[]
}

function findItem(day: Day, title: string, time?: string) {
  const matches = day.items.flatMap((item, i) => (item.title === title && (!time || item.time === time) ? [i] : []))
  if (matches.length === 0) return { error: `${day.date} 找不到標題是「${title}」的項目` }
  if (matches.length > 1) return { error: `${day.date} 有 ${matches.length} 個「${title}」，請加上 time 區分` }
  return { index: matches[0] }
}

// 依時間排序；沒有時間的項目跟著前一個有時間的項目走，排序是穩定的
function sortItems(items: Item[]) {
  let last = ''
  return items
    .map((item, i) => ({ item, i, key: (last = item.time ?? last) }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.i - b.i)
    .map((x) => x.item)
}

// 私人小任務在修改紀錄裡不寫標題（兩個人都看得到紀錄）
const label = (date: string, item: Pick<Item, 'time' | 'title' | 'private'>) =>
  `${formatDate(date, false)}${item.time ? ` ${item.time}` : ''}${item.private ? '的私人小任務' : `「${item.title}」`}`

const fieldNames: Record<string, string> = {
  time: '時間',
  end: '結束時間',
  title: '標題',
  note: '說明',
  place: '地點',
  who: '誰',
  kind: '類型',
  routeId: '交通指南',
  tentative: '建議',
  verify: '待確認',
  tzLabel: '時區',
  spotId: '地點清單',
  fixed: '固定',
  todo: '小任務',
  for: '為了哪個行程',
  private: '私人',
}

const spotFieldNames: Record<string, string> = {
  place: '名稱與地圖',
  category: '分類',
  area: '地區',
  hours: '營業時間',
  open: '營業時段',
  closed: '公休',
  access: '交通',
  tags: '標籤',
  note: '說明',
  checkedAt: '確認日期',
  verify: '待確認',
}

// 啟用備案時跟目前內容交換的欄位；誰參加、時區等其他欄位維持不變
const swapped = ['title', 'kind', 'time', 'end', 'place', 'spotId', 'routeId', 'note'] as const

function contentOf(item: Item) {
  const content: Partial<Alternative> = {}
  for (const k of swapped) if (item[k] !== undefined) Object.assign(content, { [k]: item[k] })
  return content as Pick<Alternative, (typeof swapped)[number]>
}

/** 啟用第 index 個備案：目前的內容放回備案清單的同一個位置 */
function switchToAlternative(item: Item, index: number) {
  const alts = item.alternatives!
  const chosen = alts[index]
  const used = item.usedAlternative
  let outgoing: Alternative
  if (used) {
    const content: Partial<Alternative> = contentOf(item)
    for (const k of used.inherited ?? []) delete content[k]
    outgoing = { ...(content as Alternative), trigger: used.trigger, ...(used.when && { when: used.when }) }
  } else {
    outgoing = { ...contentOf(item), trigger: 'other', original: true }
  }
  // 備案沒寫的種類、時間沿用目前的；結束時間只在時間沒變時沿用
  const inherited: ('kind' | 'time' | 'end')[] = []
  const kind = chosen.kind ?? item.kind
  if (!chosen.kind) inherited.push('kind')
  const time = chosen.time ?? item.time
  if (!chosen.time && item.time) inherited.push('time')
  const end = chosen.end ?? (chosen.time ? undefined : item.end)
  if (!chosen.end && !chosen.time && item.end) inherited.push('end')
  for (const k of swapped) delete item[k]
  Object.assign(item, {
    title: chosen.title,
    kind,
    ...(time && { time }),
    ...(end && { end }),
    ...(chosen.place && { place: chosen.place }),
    ...(chosen.spotId && { spotId: chosen.spotId }),
    ...(chosen.routeId && { routeId: chosen.routeId }),
    ...(chosen.note && { note: chosen.note }),
  })
  // 換了內容，原本的「建議」「待確認」不一定還適用
  delete item.tentative
  delete item.verify
  if (chosen.original) delete item.usedAlternative
  else
    item.usedAlternative = {
      trigger: chosen.trigger,
      ...(chosen.when && { when: chosen.when }),
      ...(inherited.length && { inherited }),
    }
  item.alternatives = alts.map((a, i) => (i === index ? outgoing : a))
  return chosen
}

/** 用 id、名稱或當地語言名稱找地點 */
function findSpot(trip: Trip, ref: string) {
  const r = ref.trim()
  return (trip.spots ?? []).find((s) => s.id === r || s.place.name === r || s.place.local === r)
}

/** 從名稱產生不重複的 id */
function spotIdFor(trip: Trip, spot: Pick<Spot, 'place'>) {
  const base =
    (spot.place.name + ' ' + (spot.place.local ?? ''))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'spot'
  const taken = new Set((trip.spots ?? []).map((s) => s.id))
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}

/** 新增的行程項目跟清單裡某個地點同名時，自動連結 */
function linkSpot(trip: Trip, item: Item) {
  if (item.spotId || !item.place) return
  const match = (trip.spots ?? []).find(
    (s) => s.place.name === item.place!.name || (!!s.place.local && s.place.local === item.place!.local),
  )
  if (match) item.spotId = match.id
}

/** 套用修改動作。不會改到傳入的 trip；有任何錯誤時 errors 不為空，trip 不可使用 */
export function applyOps(source: Trip, ops: Op[]): ApplyResult {
  const trip = structuredClone(source)
  const changes: Change[] = []
  const errors: string[] = []
  const dayOf = (date: string) => trip.days.find((d) => d.date === date)

  for (const op of ops) {
    switch (op.op) {
      case 'add_item': {
        const day = dayOf(op.date)
        if (!day) {
          errors.push(`旅程裡沒有 ${op.date} 這一天`)
          break
        }
        linkSpot(trip, op.item)
        day.items.push(op.item)
        changes.push({ kind: 'add', text: label(op.date, op.item), date: op.date })
        break
      }
      case 'update_item': {
        const day = dayOf(op.date)
        if (!day) {
          errors.push(`旅程裡沒有 ${op.date} 這一天`)
          break
        }
        const found = findItem(day, op.title, op.time)
        if ('error' in found) {
          errors.push(found.error!)
          break
        }
        const item = day.items[found.index] as Record<string, unknown>
        const before = { ...item }
        for (const [key, value] of Object.entries(op.changes)) {
          if (value === null) delete item[key]
          else item[key] = value
        }
        const fields = Object.keys(op.changes).map((k) => {
          const from = before[k]
          const to = item[k]
          const show = (v: unknown) => (typeof v === 'string' ? v : v === undefined ? '（無）' : '已修改')
          return k === 'time' || k === 'end' || k === 'title' ? `${fieldNames[k] ?? k} ${show(from)} → ${show(to)}` : (fieldNames[k] ?? k)
        })
        changes.push({ kind: 'update', text: `${label(op.date, before as Item)}：${fields.join('、')}`, date: op.date })
        break
      }
      case 'remove_item': {
        const day = dayOf(op.date)
        if (!day) {
          errors.push(`旅程裡沒有 ${op.date} 這一天`)
          break
        }
        const found = findItem(day, op.title, op.time)
        if ('error' in found) {
          errors.push(found.error!)
          break
        }
        const [removed] = day.items.splice(found.index!, 1)
        changes.push({ kind: 'remove', text: label(op.date, removed), date: op.date })
        break
      }
      case 'add_checklist_item': {
        const group = trip.checklist.find((g) => g.title === op.group)
        if (!group) {
          errors.push(`清單裡沒有「${op.group}」這一組（現有：${trip.checklist.map((g) => g.title).join('、')}）`)
          break
        }
        group.items.push({ id: `ai-${Date.now().toString(36)}-${group.items.length}`, label: op.label })
        changes.push({ kind: 'add', text: `清單「${op.group}」：${op.label}` })
        break
      }
      case 'add_pending': {
        trip.pending = [...(trip.pending ?? []), op.text]
        changes.push({ kind: 'add', text: `還缺的資料：${op.text}` })
        break
      }
      case 'remove_pending': {
        const before = trip.pending ?? []
        trip.pending = before.filter((p) => p !== op.text)
        if (trip.pending.length === before.length) errors.push(`「還缺的資料」裡沒有「${op.text}」`)
        else changes.push({ kind: 'remove', text: `還缺的資料：${op.text}` })
        break
      }
      case 'add_alternative':
      case 'remove_alternative':
      case 'use_alternative': {
        const day = dayOf(op.date)
        if (!day) {
          errors.push(`旅程裡沒有 ${op.date} 這一天`)
          break
        }
        const found = findItem(day, op.title, op.time)
        if ('error' in found) {
          errors.push(found.error!)
          break
        }
        const item = day.items[found.index!]
        const before = label(op.date, item)
        if (op.op === 'add_alternative') {
          item.alternatives = [...(item.alternatives ?? []), op.alternative]
          changes.push({ kind: 'add', text: `${before} 的備案（${triggerLabels[op.alternative.trigger]}）：${op.alternative.title}`, date: op.date })
          break
        }
        const alt = item.alternatives?.[op.index]
        if (!alt) {
          errors.push(`${before} 沒有第 ${op.index + 1} 個備案（共 ${item.alternatives?.length ?? 0} 個）`)
          break
        }
        if (op.op === 'remove_alternative') {
          if (alt.original) {
            errors.push(`${before} 的「原本的安排」不能刪，要先換回來`)
            break
          }
          item.alternatives = item.alternatives!.filter((_, i) => i !== op.index)
          if (item.alternatives.length === 0) delete item.alternatives
          changes.push({ kind: 'remove', text: `${before} 的備案（${triggerLabels[alt.trigger]}）：${alt.title}`, date: op.date })
          break
        }
        const chosen = switchToAlternative(item, op.index)
        changes.push({
          kind: 'update',
          text: chosen.original ? `${before} 換回原本的安排：「${chosen.title}」` : `${before} 改用備案（${triggerLabels[chosen.trigger]}）：「${chosen.title}」`,
          date: op.date,
        })
        break
      }
      case 'complete_task': {
        const day = dayOf(op.date)
        if (!day) {
          errors.push(`旅程裡沒有 ${op.date} 這一天`)
          break
        }
        const found = findItem(day, op.title, op.time)
        if ('error' in found) {
          errors.push(found.error!)
          break
        }
        const item = day.items[found.index!]
        if (!item.todo) {
          errors.push(`${label(op.date, item)} 不是小任務`)
          break
        }
        item.todo = op.done ? { done: true, doneAt: new Date().toISOString() } : { done: false }
        changes.push({ kind: 'update', text: `${label(op.date, item)}${op.done ? '：完成' : '：改回還沒完成'}`, date: op.date })
        break
      }
      case 'shift_items': {
        const day = dayOf(op.date)
        if (!day) {
          errors.push(`旅程裡沒有 ${op.date} 這一天`)
          break
        }
        const { moved, until, errors: shiftErrors } = shiftItems(day, op.from, op.minutes, { who: op.who, until: op.until })
        if (shiftErrors.length) {
          errors.push(...shiftErrors)
          break
        }
        if (moved === 0) {
          errors.push(`${formatDate(op.date, false)} ${op.from} 之後沒有可以挪的彈性項目`)
          break
        }
        const who = op.who ? trip.travelers.find((t) => t.id === op.who)?.name : undefined
        const amount = `${op.minutes > 0 ? '往後延' : '提前'} ${Math.abs(op.minutes)} 分`
        const range = until ? `${op.from}–${until} ` : `${op.from} 之後`
        changes.push({ kind: 'update', text: `${formatDate(op.date, false)} ${range}${who ? `「${who}」` : ''}的彈性行程${amount}（${moved} 項）`, date: op.date })
        break
      }
      case 'add_spot': {
        const name = op.spot.place.name
        if (findSpot(trip, name) || (op.spot.id && findSpot(trip, op.spot.id))) {
          errors.push(`地點清單裡已經有「${name}」，要改內容請用 update_spot`)
          break
        }
        const spot = { ...op.spot, id: op.spot.id ?? spotIdFor(trip, op.spot) } as Spot
        trip.spots = [...(trip.spots ?? []), spot]
        changes.push({ kind: 'add', text: `地點清單：${name}` })
        break
      }
      case 'update_spot': {
        const spot = findSpot(trip, op.ref) as Record<string, unknown> | undefined
        if (!spot) {
          errors.push(`地點清單裡找不到「${op.ref}」`)
          break
        }
        for (const [key, value] of Object.entries(op.spotChanges)) {
          if (value === null) delete spot[key]
          else spot[key] = value
        }
        const fields = Object.keys(op.spotChanges).map((k) => spotFieldNames[k] ?? k)
        changes.push({ kind: 'update', text: `地點清單：${(spot as Spot).place.name}：${fields.join('、')}` })
        break
      }
      case 'remove_spot': {
        const spot = findSpot(trip, op.ref)
        if (!spot) {
          errors.push(`地點清單裡找不到「${op.ref}」`)
          break
        }
        const used = trip.days.flatMap((d) => d.items.filter((i) => i.spotId === spot.id).map((i) => label(d.date, i)))
        if (used.length) {
          errors.push(`「${spot.place.name}」還排在行程裡（${used.join('、')}），要先把那些項目刪掉或改掉`)
          break
        }
        const backups = trip.days.flatMap((d) =>
          d.items.filter((i) => i.alternatives?.some((a) => a.spotId === spot.id)).map((i) => label(d.date, i)),
        )
        if (backups.length) {
          errors.push(`「${spot.place.name}」是其他項目的備案（${backups.join('、')}），要先把那些備案刪掉`)
          break
        }
        trip.spots = (trip.spots ?? []).filter((s) => s !== spot)
        changes.push({ kind: 'remove', text: `地點清單：${spot.place.name}` })
        break
      }
    }
  }

  for (const day of trip.days) day.items = sortItems(day.items)
  if (errors.length === 0) errors.push(...validateTrip(trip))
  return { trip, changes, errors }
}
