import type { Item, Trip } from '../types'

// 誰看得到哪些項目。viewer 是「看誰的行程」選的人（undefined = 全部）。
// 私人項目（驚喜用）只有負責人選了自己時才看得到，選「全部」也看不到。

export function canSee(item: Item, viewer?: string) {
  if (item.private) return !!viewer && !!item.who?.includes(viewer)
  return !viewer || !item.who || item.who.includes(viewer)
}

/** 拿掉這位使用者看不到的私人項目（交給小樹之前用，免得說溜嘴） */
export function hidePrivate(trip: Trip, viewer?: string): Trip {
  if (!trip.days.some((d) => d.items.some((i) => i.private))) return trip
  return {
    ...trip,
    days: trip.days.map((d) => ({ ...d, items: d.items.filter((i) => !i.private || canSee(i, viewer)) })),
  }
}
