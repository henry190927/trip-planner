import { describe, expect, it } from 'vitest'
import { swipeDirection } from './swipe'

describe('左右滑動切換天數', () => {
  it('明顯往左滑到下一天、往右滑回前一天', () => {
    expect(swipeDirection({ x: -100, y: 5 }, { x: -300, y: 0 })).toBe(1)
    expect(swipeDirection({ x: 100, y: -10 }, { x: 300, y: 0 })).toBe(-1)
  })

  it('快速輕撥也算，但要真的有橫移', () => {
    expect(swipeDirection({ x: -40, y: 3 }, { x: -800, y: 50 })).toBe(1)
    expect(swipeDirection({ x: -10, y: 0 }, { x: -800, y: 0 })).toBe(0)
  })

  it('往上捲時手指往旁邊偏，不切天', () => {
    // 斜斜往上滑：橫向 60、直向 120
    expect(swipeDirection({ x: -60, y: -120 }, { x: -600, y: -1200 })).toBe(0)
    // 捲到底再往上撥：直向位移小，但速度主要是直向
    expect(swipeDirection({ x: -35, y: -20 }, { x: -700, y: -1600 })).toBe(0)
    // 橫向沒有比直向大兩倍
    expect(swipeDirection({ x: -90, y: -50 }, { x: -300, y: -100 })).toBe(0)
  })

  it('距離不夠、速度也不夠就不切', () => {
    expect(swipeDirection({ x: -50, y: 0 }, { x: -200, y: 0 })).toBe(0)
  })
})
