import type { z } from 'zod'
import type { opSchema } from '../schema'
import type { Day, Item, Trip } from '../types'
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

const label = (date: string, item: Pick<Item, 'time' | 'title'>) =>
  `${formatDate(date, false)}${item.time ? ` ${item.time}` : ''}「${item.title}」`

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
    }
  }

  for (const day of trip.days) day.items = sortItems(day.items)
  if (errors.length === 0) errors.push(...validateTrip(trip))
  return { trip, changes, errors }
}
