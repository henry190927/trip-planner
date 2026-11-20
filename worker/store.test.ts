import { describe, expect, it } from 'vitest'
import { seoul2026 } from '../test/fixtures/seoul-2026-11'

const trips = [seoul2026]
import type { Env } from './env'
import { createTrip, loadTrip, saveTrip, tripIds, undo } from './store'

function emptyEnv() {
  const kv = new Map<string, string>()
  const TRIPS = {
    get: async (k: string) => (kv.has(k) ? JSON.parse(kv.get(k)!) : null),
    put: async (k: string, v: string) => void kv.set(k, v),
  }
  return { TRIPS } as unknown as Env
}

// 有一個行程（第 0 版）的 KV；版號從 0 開始，跟測試原本的寫法一致
function fakeEnv() {
  const env = emptyEnv()
  const v0 = { version: 0, updatedAt: new Date(0).toISOString(), summary: '初始版本', trip: trips[0] }
  void env.TRIPS.put(`trip:${trips[0].id}`, JSON.stringify(v0))
  void env.TRIPS.put(`trip:${trips[0].id}:v:0`, JSON.stringify(v0))
  return env
}

const id = trips[0].id
const added = { kind: 'add' as const, text: '11/7 16:00「逛街」', date: '2026-11-07' }

describe('變動紀錄', () => {
  it('每次存檔都在紀錄最前面加一筆，帶著變動內容', async () => {
    const env = fakeEnv()
    const v0 = (await loadTrip(env, id))!
    const v1 = await saveTrip(env, id, v0.trip, '加逛街', v0, { source: 'ai', changes: [added] })
    const v2 = await saveTrip(env, id, v1.trip, '從程式碼同步', v1, { source: 'sync' })
    expect(v2.log!.map((e) => [e.version, e.source, e.summary])).toEqual([
      [2, 'sync', '從程式碼同步'],
      [1, 'ai', '加逛街'],
    ])
    expect(v2.log![1].changes).toEqual([added])
    expect((await loadTrip(env, id))!.log).toHaveLength(2)
  })

  it('復原會把被復原那次的變動反過來列出，而且紀錄不會跟著退回去', async () => {
    const env = fakeEnv()
    const v0 = (await loadTrip(env, id))!
    const v1 = await saveTrip(env, id, v0.trip, '加逛街', v0, { source: 'ai', changes: [added, { kind: 'update', text: '改時間' }] })
    const v2 = (await undo(env, id, v1))!
    expect(v2.version).toBe(2)
    expect(v2.log![0]).toMatchObject({ source: 'undo', summary: '復原：加逛街' })
    expect(v2.log![0].changes).toEqual([{ ...added, kind: 'remove' }, { kind: 'update', text: '改時間' }])
    expect(v2.log!.map((e) => e.version)).toEqual([2, 1])
  })

  it('連按復原不會一路往前退：第二次復原等於重做，內容跟紀錄一致', async () => {
    const env = fakeEnv()
    const v0 = (await loadTrip(env, id))!
    const sync = await saveTrip(env, id, { ...v0.trip, title: '同步過' }, '從程式碼同步', v0, { source: 'sync' })
    const withItem = await saveTrip(env, id, { ...sync.trip, title: '加了東西' }, '加東西', sync, { source: 'ai', changes: [added] })
    const u1 = (await undo(env, id, withItem))!
    expect(u1.trip.title).toBe('同步過')
    const u2 = (await undo(env, id, u1))!
    // 重做：回到加了東西的狀態，不是退回同步之前
    expect(u2.trip.title).toBe('加了東西')
    expect(u2.log![0].changes).toEqual([added])
    const u3 = (await undo(env, id, u2))!
    expect(u3.trip.title).toBe('同步過')
  })

  it('最多留 50 筆', async () => {
    const env = fakeEnv()
    let cur = (await loadTrip(env, id))!
    for (let i = 0; i < 55; i++) cur = await saveTrip(env, id, cur.trip, `第 ${i + 1} 次`, cur, { source: 'ai' })
    expect(cur.log).toHaveLength(50)
    expect(cur.log![0].summary).toBe('第 55 次')
  })
})

describe('行程只存在 KV', () => {
  it('建立行程：第 1 版，加進清單；同 id 再建立會被拒絕', async () => {
    const env = emptyEnv()
    expect(await tripIds(env)).toEqual([])
    expect(await loadTrip(env, id)).toBeUndefined()
    const first = await createTrip(env, trips[0], '建立行程')
    expect(first.version).toBe(1)
    expect(first.parent).toBeUndefined()
    expect(await tripIds(env)).toEqual([id])
    await expect(createTrip(env, trips[0], '再建一次')).rejects.toThrow('已經有')
  })

  it('變動紀錄記下是誰改的', async () => {
    const env = fakeEnv()
    const v0 = (await loadTrip(env, id))!
    const v1 = await saveTrip(env, id, v0.trip, '加逛街', v0, { source: 'ai', changes: [added], by: '她' })
    expect(v1.log![0].by).toBe('她')
    const u = (await undo(env, id, v1, '我'))!
    expect(u.log![0]).toMatchObject({ source: 'undo', by: '我' })
  })
})
