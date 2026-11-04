interface Point {
  x: number
  y: number
}

/**
 * 判斷一次拖曳要不要切到前一天 / 下一天：1 下一天、-1 前一天、0 不切。
 * 往上下捲的時候手指多少會往旁邊偏，所以要橫向明顯大於直向才算，
 * 而且一定要真的橫移一段距離；快速輕撥可以短一點，但不能只靠速度
 */
export function swipeDirection(offset: Point, velocity: Point) {
  const dx = Math.abs(offset.x)
  const horizontal = dx > Math.abs(offset.y) * 2
  const far = dx > 70
  const flick = dx > 30 && Math.abs(velocity.x) > 500 && Math.abs(velocity.x) > Math.abs(velocity.y) * 2
  if (!horizontal || !(far || flick)) return 0
  return offset.x < 0 ? 1 : -1
}
