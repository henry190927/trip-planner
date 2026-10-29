import type { Spot, SpotCategory, Trip } from '../types'
import { nowIn } from './time'

// 地點編輯表單與修改動作之間的轉換

export interface SpotForm {
  name: string
  local: string
  mapQuery: string
  mapLink: string
  category: SpotCategory
  area: string
  hours: string
  closed: string
  access: string
  tags: string
  note: string
  verify: string
}

export const toForm = (s?: Spot): SpotForm => ({
  name: s?.place.name ?? '',
  local: s?.place.local ?? '',
  mapQuery: s?.place.mapQuery ?? '',
  mapLink: s?.place.mapLink ?? '',
  category: s?.category ?? 'food',
  area: s?.area ?? '',
  hours: s?.hours ?? '',
  closed: s?.closed ?? '',
  access: s?.access ?? '',
  tags: s?.tags?.join('、') ?? '',
  note: s?.note ?? '',
  verify: s?.verify ?? '',
})

const optional = ['area', 'hours', 'closed', 'access', 'note', 'verify'] as const

/** 表單 → 修改動作。只送有改的欄位；清空代表刪掉那個欄位 */
export function spotOps(trip: Trip, form: SpotForm, spot?: Spot) {
  const today = nowIn(trip.timezone).date
  const tags = form.tags
    .split(/[、,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
  const place = {
    ...spot?.place,
    name: form.name.trim(),
    ...(form.local.trim() ? { local: form.local.trim() } : { local: undefined }),
    ...(form.mapQuery.trim() ? { mapQuery: form.mapQuery.trim() } : { mapQuery: undefined }),
    ...(form.mapLink.trim() ? { mapLink: form.mapLink.trim() } : { mapLink: undefined }),
  }
  // 拿掉值是 undefined 的鍵，資料才乾淨
  const cleanPlace = Object.fromEntries(Object.entries(place).filter(([, v]) => v !== undefined)) as Spot['place']

  if (!spot) {
    const fields = Object.fromEntries(optional.map((k) => [k, form[k].trim()]).filter(([, v]) => v))
    return [
      {
        op: 'add_spot',
        spot: { place: cleanPlace, category: form.category, ...fields, ...(tags.length && { tags }), ...(form.hours.trim() && { checkedAt: today }) },
      },
    ]
  }

  const changes: Record<string, unknown> = {}
  if (JSON.stringify(cleanPlace) !== JSON.stringify(spot.place)) changes.place = cleanPlace
  if (form.category !== spot.category) changes.category = form.category
  for (const k of optional) {
    const next = form[k].trim()
    if (next !== (spot[k] ?? '')) changes[k] = next || null
  }
  if (tags.join('、') !== (spot.tags ?? []).join('、')) changes.tags = tags.length ? tags : null
  if ('hours' in changes) {
    // 手動改了營業時間：記今天確認；判斷「營業中」的時段可能已經不對，先拿掉
    changes.checkedAt = changes.hours ? today : null
    if (spot.open) changes.open = null
  }
  return Object.keys(changes).length ? [{ op: 'update_spot', ref: spot.id, spotChanges: changes }] : []
}

