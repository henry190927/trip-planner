import type { Day, Item } from '../types'

// 動態調整用的時間計算：哪些項目不能動、某段時間有多少空檔、整段挪時間。
// 跨時區的項目（tzLabel，例如出發地的時間）不參與計算。

export const isFixed = (item: Item) => item.fixed ?? (item.kind === 'flight' || item.kind === 'concert')

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const toHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** 兩個項目有沒有共同的人（沒填 who 代表全員） */
export const shareSomeone = (a: Item, b: Item) => !a.who || !b.who || a.who.some((id) => b.who!.includes(id))
const visibleTo = (item: Item, who?: string) => !who || !item.who || item.who.includes(who)
const local = (item: Item): item is Item & { time: string } => !!item.time && !item.tzLabel

export interface FreeWindow {
  /** 空檔從哪裡開始：前一個固定行程結束（沒寫結束時間就用開始時間），或指定的 after */
  from: string
  fromLabel: string
  /** 到下一個固定行程開始；沒有下一個就是 null（當天之後都空） */
  to: string | null
  toLabel: string | null
  minutes: number | null
  /** 空檔裡目前排的彈性項目 */
  flexible: string[]
}

/** 某天（某位旅伴）在固定行程之間的空檔 */
export function freeWindows(day: Day, { who, after }: { who?: string; after?: string } = {}): FreeWindow[] {
  const items = day.items.filter((i) => local(i) && visibleTo(i, who)) as (Item & { time: string })[]
  const anchors = items.filter(isFixed)
  const windows: FreeWindow[] = []
  let from = after ?? '00:00'
  let fromLabel = after ? '現在' : '一天開始'
  for (const next of [...anchors, null]) {
    const to = next?.time ?? null
    if (to === null || toMin(to) > toMin(from)) {
      const flexible = items.filter((i) => !isFixed(i) && toMin(i.time) >= toMin(from) && (to === null || toMin(i.time) < toMin(to)))
      windows.push({
        from,
        fromLabel,
        to,
        toLabel: next ? `${next.time}「${next.title}」` : null,
        minutes: to === null ? null : toMin(to) - toMin(from),
        flexible: flexible.map((i) => `${i.time}「${i.title}」`),
      })
    }
    if (next) {
      const end = next.end ?? next.time
      if (toMin(end) > toMin(from)) {
        from = end
        fromLabel = `${next.title}${next.end ? '結束' : '開始'}`
      }
    }
  }
  return windows
}

/** 只屬於某位旅伴的項目（全員一起的不算） */
const ownedBy = (item: Item, who: string) => !!item.who?.includes(who)

/**
 * 把 from 開始的彈性項目挪 minutes 分鐘，預設挪到下一個固定行程之前（until 可以指定）。
 * 固定的項目不動；每個被挪的項目不能越過「跟它有共同旅伴的固定行程」，越過了就整個不挪並回報。
 */
export function shiftItems(
  day: Day,
  from: string,
  minutes: number,
  { who, until }: { who?: string; until?: string } = {},
): { moved: number; until: string | null; errors: string[] } {
  const timed = day.items.filter(local) as (Item & { time: string })[]
  const anchors = timed.filter(isFixed)
  const stop =
    until ?? anchors.find((a) => toMin(a.time) > toMin(from) && (!who || visibleTo(a, who)))?.time ?? null
  const targets = timed.filter(
    (i) =>
      !isFixed(i) &&
      toMin(i.time) >= toMin(from) &&
      (stop === null || toMin(i.time) < toMin(stop)) &&
      (!who || ownedBy(i, who)),
  )
  const errors = moveItems(targets, minutes, anchors)
  return { moved: errors.length ? 0 : targets.length, until: stop, errors }
}

/** 把 targets 一起挪 minutes 分鐘；任何一個會越過跟它有共同旅伴的固定行程就整批不挪、回報原因 */
function moveItems(targets: (Item & { time: string })[], minutes: number, anchors: (Item & { time: string })[], dryRun = false) {
  const errors: string[] = []
  const plans = targets.map((item) => {
    const start = toMin(item.time) + minutes
    const end = item.end ? toMin(item.end) + minutes : undefined
    if (start < 0 || (end ?? start) > 24 * 60) errors.push(`「${item.title}」會被挪出當天`)
    // 往後挪：不能撞到後面的固定行程；往前挪：不能早於前面固定行程的結束
    const wall =
      minutes > 0
        ? anchors.find((a) => toMin(a.time) > toMin(item.time) && shareSomeone(a, item))
        : anchors.filter((a) => toMin(a.time) <= toMin(item.time) && shareSomeone(a, item)).at(-1)
    if (wall && minutes > 0 && (end ?? start) > toMin(wall.time))
      errors.push(`「${item.title}」挪到 ${toHhmm(start)} 會撞到固定行程 ${wall.time}「${wall.title}」`)
    if (wall && minutes < 0 && start < toMin(wall.end ?? wall.time))
      errors.push(`「${item.title}」挪到 ${toHhmm(start)} 會早於固定行程「${wall.title}」${wall.end ? `結束（${wall.end}）` : `（${wall.time}）`}`)
    return { item, start, end }
  })
  if (!errors.length && !dryRun)
    for (const { item, start, end } of plans) {
      item.time = toHhmm(start)
      if (end !== undefined) item.end = toHhmm(end)
    }
  return errors
}

/**
 * 插入新項目前先騰出空間（骨牌式、每個人各一條線）：在它之後的彈性項目，只有被同一個人的前一件事蓋到才往後推；
 * 兩個人一起的項目要等兩個人都空出來。中間有空檔就吸收掉，不會無謂地動到後面的行程。
 * 被推的項目不能越過跟它有共同旅伴的固定行程，否則整批不動、回報原因。新項目本身不會加進 day。
 */
export function makeRoom(
  day: Day,
  item: Item,
  travelers: string[],
): { moved: { title: string; from: string; to: string; private?: boolean }[]; errors: string[] } {
  if (!item.time || !item.end || item.tzLabel) return { moved: [], errors: [] }
  const timed = day.items.filter(local) as (Item & { time: string })[]
  const anchors = timed.filter(isFixed)
  const people = (i: Item) => i.who ?? travelers
  // 每個人從什麼時候開始有空
  const free = new Map(people(item).map((p) => [p, toMin(item.end!)]))
  const targets = timed
    .filter((i) => !isFixed(i) && shareSomeone(i, item) && toMin(i.time) >= toMin(item.time!))
    .sort((x, y) => toMin(x.time) - toMin(y.time))
  const plans: { item: Item & { time: string }; minutes: number }[] = []
  for (const t of targets) {
    const start = toMin(t.time)
    const length = t.end ? toMin(t.end) - start : 0
    const ready = Math.max(start, ...people(t).map((p) => free.get(p) ?? start))
    if (ready > start) plans.push({ item: t, minutes: ready - start })
    for (const p of people(t)) free.set(p, Math.max(free.get(p) ?? 0, ready + length))
  }
  const errors = plans.flatMap(({ item: t, minutes }) => moveItems([t], minutes, anchors, true))
  if (errors.length) return { moved: [], errors }
  const moved = plans.map(({ item: t, minutes }) => ({ title: t.title, from: t.time, to: toHhmm(toMin(t.time) + minutes), private: t.private }))
  for (const { item: t, minutes } of plans) moveItems([t], minutes, anchors)
  return { moved, errors }
}

/**
 * 同一個人同時有兩件事：有共同旅伴、而且時間重疊（沒有結束時間的當成一個時間點，開始時間相同也算）。
 * 回傳像「14:45「A」和 14:45「B」」的說明，用來擋下排出衝突的修改。
 */
export function overlaps(day: Day): string[] {
  const timed = day.items.filter(local) as (Item & { time: string })[]
  const span = (i: Item & { time: string }) => [toMin(i.time), i.end ? toMin(i.end) : toMin(i.time)] as const
  const found: string[] = []
  timed.forEach((a, i) =>
    timed.slice(i + 1).forEach((b) => {
      if (!shareSomeone(a, b)) return
      const [as, ae] = span(a)
      const [bs, be] = span(b)
      if (as === bs || (as < be && bs < ae)) found.push(`${a.time}「${a.title}」和 ${b.time}「${b.title}」`)
    }),
  )
  return found
}
