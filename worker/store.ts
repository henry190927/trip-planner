import type { Change } from '../src/lib/ops'
import type { Trip } from '../src/types'
import type { Env } from './env'

// KV 版面（行程只存在這裡，不放進程式碼）：
//   trips              所有行程的 id 清單
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
  /** 誰改的（登入的人的名字）；sync 是從電腦上的腳本 */
  by?: string
}

const LOG_SIZE = 50

const key = (id: string) => `trip:${id}`
const versionKey = (id: string, v: number) => `trip:${id}:v:${v}`
const keepSeconds = 90 * 24 * 3600

const INDEX_KEY = 'trips'

export const tripIds = async (env: Env) => (await env.TRIPS.get<string[]>(INDEX_KEY, 'json')) ?? []

export const loadTrip = async (env: Env, id: string) => (await env.TRIPS.get<Stored>(key(id), 'json')) ?? undefined

/** 建立新行程（第 1 版），並加進行程清單；已經有同 id 的就拒絕，免得蓋掉線上的修改 */
export async function createTrip(env: Env, trip: Trip, summary: string) {
  if (await loadTrip(env, trip.id)) throw new Error(`已經有 ${trip.id} 這個行程了`)
  const updatedAt = new Date().toISOString()
  const first: Stored = {
    version: 1,
    updatedAt,
    summary,
    trip,
    log: [{ version: 1, at: updatedAt, source: 'sync', summary, changes: [] }],
  }
  const body = JSON.stringify(first)
  await env.TRIPS.put(versionKey(trip.id, 1), body, { expirationTtl: keepSeconds })
  await env.TRIPS.put(key(trip.id), body)
  const ids = await tripIds(env)
  if (!ids.includes(trip.id)) await env.TRIPS.put(INDEX_KEY, JSON.stringify([...ids, trip.id]))
  return first
}

interface SaveOptions {
  source: LogEntry['source']
  changes?: Change[]
  by?: string
  /** 預設是上一版；復原時指定成被復原那一版的上一版 */
  parent?: number
}

export async function saveTrip(env: Env, id: string, trip: Trip, summary: string, previous: Stored, options: SaveOptions) {
  const version = previous.version + 1
  const updatedAt = new Date().toISOString()
  const entry: LogEntry = {
    version,
    at: updatedAt,
    source: options.source,
    summary,
    changes: options.changes ?? [],
    ...(options.by && { by: options.by }),
  }
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
export async function undo(env: Env, id: string, current: Stored, by?: string) {
  if (current.parent === undefined) return undefined
  const target = await env.TRIPS.get<Stored>(versionKey(id, current.parent), 'json')
  if (!target) return undefined
  // 被復原的那一次如果有紀錄，就把它的變動反過來列出
  const undone = current.log?.[0]?.version === current.version ? current.log[0].changes : []
  return saveTrip(env, id, target.trip, `復原：${current.summary}`, current, {
    source: 'undo',
    changes: undone.map((c) => ({ ...c, kind: inverse[c.kind] })),
    parent: current.version,
    by,
  })
}
