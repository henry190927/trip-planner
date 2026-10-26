import { describe, expect, it } from 'vitest'
import { daysBetween, formatDate, tripPhase } from './time'
import { relativeTime } from './dates'
import { seoul2026 } from '../trips/seoul-2026-11'

describe('tripPhase', () => {
  it('出發前回傳剩幾天', () => {
    expect(tripPhase(seoul2026, '2026-10-24')).toEqual({ kind: 'before', days: 13 })
  })
  it('旅程中回傳第幾天', () => {
    expect(tripPhase(seoul2026, '2026-11-06')).toEqual({ kind: 'during', dayIndex: 0 })
    expect(tripPhase(seoul2026, '2026-11-08')).toEqual({ kind: 'during', dayIndex: 2 })
  })
  it('結束後', () => {
    expect(tripPhase(seoul2026, '2026-11-09')).toEqual({ kind: 'after' })
  })
})

describe('日期工具', () => {
  it('跨月計算天數', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1)
  })
  it('格式化含星期', () => {
    expect(formatDate('2026-11-06')).toBe('11/6（五）')
  })
})

describe('relativeTime', () => {
  const now = new Date(2026, 10, 7, 14, 30)
  const at = (d: Date) => d.toISOString()
  it('依時間遠近顯示', () => {
    expect(relativeTime(at(new Date(2026, 10, 7, 14, 29, 40)), now)).toBe('剛剛')
    expect(relativeTime(at(new Date(2026, 10, 7, 14, 5)), now)).toBe('25 分鐘前')
    expect(relativeTime(at(new Date(2026, 10, 7, 9, 5)), now)).toBe('今天 09:05')
    expect(relativeTime(at(new Date(2026, 10, 6, 22, 10)), now)).toBe('昨天 22:10')
    expect(relativeTime(at(new Date(2026, 9, 25, 8, 0)), now)).toBe('10/25 08:00')
  })
})
