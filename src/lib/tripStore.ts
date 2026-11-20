import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Trip } from '../types'
import { fetchTrips, type Versioned } from './api'

// 行程資料只放在後端（登入才拿得到），網站本身不含任何行程。
// 拿到的最新版會存在這支手機上：出國沒網路時就用上次存下來的那份；登出時清掉。
const CACHE_KEY = 'trip-cache-v1'

function readCache(): Record<string, Versioned> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, Versioned>
  } catch {
    return {}
  }
}

function writeCache(data: Record<string, Versioned>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // 存不了就算了，下次重新抓
  }
}

export const hasTripCache = () => Object.keys(readCache()).length > 0

export function clearTripCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // 沒有也沒關係
  }
  useTrips.setState({ byId: {}, status: 'idle' })
}

interface TripState {
  byId: Record<string, Versioned>
  status: 'idle' | 'loading' | 'live' | 'offline'
  refresh: () => Promise<void>
  replace: (v: Versioned) => void
}

export const useTrips = create<TripState>()((set, get) => ({
  byId: readCache(),
  status: 'idle',
  refresh: async () => {
    set({ status: 'loading' })
    try {
      const { trips } = await fetchTrips()
      // 以後端為準：後端已經沒有的行程（例如刪掉了）也從這支手機上拿掉
      const byId = Object.fromEntries(trips.map((v) => [v.trip.id, v]))
      writeCache(byId)
      set({ byId, status: 'live' })
    } catch {
      set({ status: 'offline' })
    }
  },
  replace: (v) => {
    const byId = { ...get().byId, [v.trip.id]: v }
    writeCache(byId)
    set({ byId })
  },
}))

export const useTrip = (id?: string): Trip | undefined => useTrips((s) => (id ? s.byId[id]?.trip : undefined))
/** 首頁的行程清單：新的（出發日期晚的）在前 */
export const useTripList = () =>
  useTrips(useShallow((s) => Object.values(s.byId).map((v) => v.trip).sort((a, b) => b.startDate.localeCompare(a.startDate))))
