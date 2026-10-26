import { describe, expect, it } from 'vitest'
import { seoul2026 } from '../trips/seoul-2026-11'
import { quickActions } from './quickActions'

describe('quickActions', () => {
  it('不在旅程期間就沒有快捷按鈕', () => {
    expect(quickActions(seoul2026, { date: '2026-10-27', time: '12:00' })).toEqual([])
  })

  it('帶上現在時間、目前所在的地點、下一個跟自己有關的固定行程', () => {
    const her = quickActions(seoul2026, { date: '2026-11-07', time: '13:10' }, 'her')
    const early = her.find((a) => a.label === '早到了')!.text
    expect(early).toContain('現在是 11/7 13:10（我是「她」）')
    expect(early).toContain('15:30「取票・周邊排隊」')
    expect(her.find((a) => a.label === '附近吃的')!.text).toContain('「EPT 弘大店」附近')
    // 我沒有取票，下一個固定行程是兩個人的散場會合
    const me = quickActions(seoul2026, { date: '2026-11-07', time: '15:00' }, 'me')
    expect(me.find((a) => a.label === '早到了')!.text).toContain('20:30「散場會合」')
  })
})
