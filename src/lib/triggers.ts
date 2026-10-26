import type { Trigger } from '../types'

// 備案的觸發條件：修改紀錄與畫面共用的說法
export const triggerLabels: Record<Trigger, string> = {
  full: '客滿',
  closed: '沒開',
  rain: '下雨',
  tired: '太累',
  early: '早到',
  late: '晚到',
  other: '其他',
}
