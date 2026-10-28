import type { Change } from '../src/lib/ops'
import type { Trip } from '../src/types'
import { trips as seeds } from '../src/trips'
import type { Env } from './env'

// KV 版面：
//   trip:<id>          目前版本 { version, updatedAt, summary, trip, parent, log }
//   trip:<id>:v:<n>    每個版本的快照，保留 90 天，用來復原
export interface Stored {
  version: number
  updatedAt: string
  summary: string
  trip: Trip
  /** 這個版本是從哪一版改來的；復原就是回到它。內建的第 0 版沒有 */
  parent?: number
  /** 最近的變動紀錄（新的在前），網站右上角的通知用 */
  log?: LogEntry[]
}

export interface LogEntry {
  version: number
  at: string
  /** ai：小樹提的修改被套用；manual：在畫面上直接操作（例如啟用備案）；undo：復原；sync：從程式碼同步 */
  source: 'ai' | 'manual' | 'undo' | 'sync'
  summary: string
  changes: Change[]
}

const LOG_SIZE = 50

const key = (id: string) => `trip:${id}`
const versionKey = (id: string, v: number) => `trip:${id}:v:${v}`
const keepSeconds = 90 * 24 * 3600

export const tripIds = () => seeds.map((t) => t.id)

/** KV 裡還沒有資料時，用程式內建的行程當第 0 版 */
export async function loadTrip(env: Env, id: string): Promise<Stored | undefined> {
  const stored = await env.TRIPS.get<Stored>(key(id), 'json')
  if (stored) return stored
  const seed = seeds.find((t) => t.id === id)
  return seed && { version: 0, updatedAt: new Date(0).toISOString(), summary: '初始版本', trip: seed }
}

interface SaveOptions {
  source: LogEntry['source']
  changes?: Change[]
  /** 預設是上一版；復原時指定成被復原那一版的上一版 */
  parent?: number
}

export async function saveTrip(env: Env, id: string, trip: Trip, summary: string, previous: Stored, options: SaveOptions) {
  // 第一次寫入時，把內建的第 0 版也存一份，才能復原回去
  if (previous.version === 0) await env.TRIPS.put(versionKey(id, 0), JSON.stringify(previous), { expirationTtl: keepSeconds })
  const version = previous.version + 1
  const updatedAt = new Date().toISOString()
  const entry: LogEntry = { version, at: updatedAt, source: options.source, summary, changes: options.changes ?? [] }
  const next: Stored = {
    version,
    updatedAt,
    summary,
    trip,
    parent: 'parent' in options ? options.parent : previous.version,
    // 紀錄一律接在目前這一版的後面：復原時也不會把紀錄退回去
    log: [entry, ...(previous.log ?? [])].slice(0, LOG_SIZE),
  }
  const body = JSON.stringify(next)
  await env.TRIPS.put(versionKey(id, version), body, { expirationTtl: keepSeconds })
  await env.TRIPS.put(key(id), body)
  return next
}

const inverse: Record<Change['kind'], Change['kind']> = { add: 'remove', remove: 'add', update: 'update' }

/**
 * 復原最新那一次修改：把它之前那一版的內容存成新的一版（歷史只往前長，不刪東西）。
 * 新的一版的 parent 指回被復原的那一版，所以再按一次復原就是重做，不會一路往前退。
 */
export async function undo(env: Env, id: string, current: Stored) {
  if (current.parent === undefined) return undefined
  const target = await env.TRIPS.get<Stored>(versionKey(id, current.parent), 'json')
  if (!target) return undefined
  // 被復原的那一次如果有紀錄，就把它的變動反過來列出
  const undone = current.log?.[0]?.version === current.version ? current.log[0].changes : []
  return saveTrip(env, id, target.trip, `復原：${current.summary}`, current, {
    source: 'undo',
    changes: undone.map((c) => ({ ...c, kind: inverse[c.kind] })),
    parent: current.version,
  })
}
