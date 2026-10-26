import { describe, expect, it } from 'vitest'
import { openStatus } from './hours'

// 2026-11-06 是星期五（5）、11-07 星期六（6）、11-08 星期日（0）
describe('openStatus', () => {
  const lunchDinner = [
    { days: [1, 2, 3, 4, 5, 6, 0], from: '12:00', to: '15:00' },
    { days: [1, 2, 3, 4, 5, 6, 0], from: '17:00', to: '23:00' },
  ]

  it('沒有資料就是 unknown', () => {
    expect(openStatus(undefined, '2026-11-06', '12:00')).toBe('unknown')
    expect(openStatus([], '2026-11-06', '12:00')).toBe('unknown')
  })

  it('分段營業：午休時間算休息中，結束時間當下算已打烊', () => {
    expect(openStatus(lunchDinner, '2026-11-06', '12:00')).toBe('open')
    expect(openStatus(lunchDinner, '2026-11-06', '15:30')).toBe('closed')
    expect(openStatus(lunchDinner, '2026-11-06', '22:59')).toBe('open')
    expect(openStatus(lunchDinner, '2026-11-06', '23:00')).toBe('closed')
  })

  it('營業到隔天凌晨：前一天開始的時段延續到今天', () => {
    const late = [{ days: [5, 6], from: '18:00', to: '02:00' }]
    expect(openStatus(late, '2026-11-07', '01:30')).toBe('open') // 週五晚上開始
    expect(openStatus(late, '2026-11-07', '02:00')).toBe('closed')
    expect(openStatus(late, '2026-11-08', '01:00')).toBe('open') // 週六晚上開始
    expect(openStatus(late, '2026-11-08', '19:00')).toBe('closed') // 週日沒開
  })

  it('營業到午夜（24:00）', () => {
    const toMidnight = [{ days: [6], from: '12:30', to: '24:00' }]
    expect(openStatus(toMidnight, '2026-11-07', '23:59')).toBe('open')
    expect(openStatus(toMidnight, '2026-11-08', '00:10')).toBe('closed')
  })

  it('公休日', () => {
    expect(openStatus([{ days: [1, 2, 3, 4, 5], from: '10:00', to: '20:00' }], '2026-11-08', '12:00')).toBe('closed')
  })
})
