import { describe, expect, it } from 'vitest'
import { trips } from '../src/trips'
import type { Env } from './env'
import { loadTrip, saveTrip, undo } from './store'

function fakeEnv() {
  const kv = new Map<string, string>()
  const TRIPS = {
    get: async (k: string) => (kv.has(k) ? JSON.parse(kv.get(k)!) : null),
    put: async (k: string, v: string) => void kv.set(k, v),
  }
  return { TRIPS } as unknown as Env
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

  it('最多留 50 筆', async () => {
    const env = fakeEnv()
    let cur = (await loadTrip(env, id))!
    for (let i = 0; i < 55; i++) cur = await saveTrip(env, id, cur.trip, `第 ${i + 1} 次`, cur, { source: 'ai' })
    expect(cur.log).toHaveLength(50)
    expect(cur.log![0].summary).toBe('第 55 次')
  })
})
