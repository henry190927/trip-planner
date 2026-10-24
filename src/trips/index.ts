import type { Trip } from '../types'
import { seoul2026 } from './seoul-2026-11'

// 新增旅程：在這個資料夾加一個檔案，然後放進這個陣列
export const trips: Trip[] = [seoul2026]

// 還沒有資料、只在首頁顯示的旅程
export const upcoming = [{ title: '名古屋', subtitle: '年末旅行', emoji: '🏯', when: '2026 年 12 月底' }]

export const getTrip = (id: string) => trips.find((t) => t.id === id)
