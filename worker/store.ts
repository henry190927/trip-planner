import type { Trip } from '../src/types'
import { trips as seeds } from '../src/trips'
import type { Env } from './env'

// KV 版面：
//   trip:<id>          目前版本 { version, updatedAt, summary, trip }
//   trip:<id>:v:<n>    每個版本的快照，保留 90 天，用來復原
export interface Stored {
  version: number
  updatedAt: string
  summary: string
  trip: Trip
  /** 這個版本是從哪一版改來的；復原就是回到它。內建的第 0 版沒有 */
  parent?: number
}

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

export async function saveTrip(env: Env, id: string, trip: Trip, summary: string, previous: Stored, parent = previous.version) {
  // 第一次寫入時，把內建的第 0 版也存一份，才能復原回去
  if (previous.version === 0) await env.TRIPS.put(versionKey(id, 0), JSON.stringify(previous), { expirationTtl: keepSeconds })
  const next: Stored = { version: previous.version + 1, updatedAt: new Date().toISOString(), summary, trip, parent }
  const body = JSON.stringify(next)
  await env.TRIPS.put(versionKey(id, next.version), body, { expirationTtl: keepSeconds })
  await env.TRIPS.put(key(id), body)
  return next
}

/** 回到上一版：把 parent 那一版的內容存成新的一版（歷史只往前長，不刪東西） */
export async function undo(env: Env, id: string, current: Stored) {
  if (current.parent === undefined) return undefined
  const target = await env.TRIPS.get<Stored>(versionKey(id, current.parent), 'json')
  if (!target) return undefined
  return saveTrip(env, id, target.trip, `復原：${current.summary}`, current, target.parent)
}
