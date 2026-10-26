import type { Trip } from '../types'
import { formatDate } from './dates'
import { isFixed } from './plan'
import type { ZonedNow } from './time'
import { canSee } from './visibility'

// 旅行中聊天框的快捷按鈕：按了先把一段話填進輸入框（附上現在時間與下一個固定行程），使用者可以改了再送

export interface QuickAction {
  label: string
  text: string
}

export function quickActions(trip: Trip, now: ZonedNow, viewer?: string): QuickAction[] {
  const day = trip.days.find((d) => d.date === now.date)
  if (!day) return []
  const mine = day.items.filter((i) => i.time && !i.tzLabel && canSee(i, viewer))
  const current = mine.filter((i) => i.time! <= now.time).at(-1)
  const nextFixed = mine.find((i) => i.time! > now.time && isFixed(i))
  const me = viewer ? trip.travelers.find((t) => t.id === viewer)?.name : undefined
  const when = `現在是 ${formatDate(now.date, false)} ${now.time}${me ? `（我是「${me}」）` : ''}`
  const where = current?.place?.name ?? current?.title
  const next = nextFixed ? `${nextFixed.time}「${nextFixed.title}」` : '今天結束'
  return [
    { label: '晚到了', text: `我們晚了大約 30 分鐘，${when}。幫我看接下來的彈性行程要不要往後延，固定的行程不能動。` },
    { label: '早到了', text: `我們比預定早到，${when}。到下一個固定行程 ${next} 之前的空檔可以做什麼？` },
    { label: '附近吃的', text: `${when}，我們在${where ? `「${where}」` : '目前的行程'}附近，想找熱熱的東西吃，先看地點清單裡同一區的。` },
    { label: '下雨了', text: `外面下雨了，${when}。接下來的行程有沒有下雨的備案？沒有的話幫我找室內的替代。` },
    { label: '好累', text: `好累想休息，${when}。看接下來哪些彈性行程可以刪掉或縮短，先回住宿也可以。` },
  ]
}
