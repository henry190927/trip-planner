import { describe, expect, it } from 'vitest'
import { integrityErrors, validateTrip } from '../../src/lib/validate'
import { seoul2026 } from './seoul-2026-11'

const trips = [seoul2026]

// 測試用的行程是手寫的，這裡把「型別檢查抓不到」的錯誤擋在部署之前
describe.each(trips.map((t) => [t.id, t] as const))('%s', (_, trip) => {
  it('符合 schema 與資料完整性規則', () => {
    expect(validateTrip(trip)).toEqual([])
  })

  it('完整性規則真的會抓到錯誤', () => {
    const broken = structuredClone(trip)
    broken.days[0].items.reverse()
    broken.days[0].items[0].routeId = 'no-such-route'
    const errors = integrityErrors(broken)
    expect(errors.some((e) => e.includes('沒有依時間排序'))).toBe(true)
    expect(errors.some((e) => e.includes('no-such-route'))).toBe(true)
  })
})
