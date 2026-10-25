import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { trips as bundled } from '../trips'
import type { Trip } from '../types'
import { fetchTrips, type Versioned } from './api'

// 行程資料的來源順序：後端最新版 → 這支手機上次拿到的版本 → 網站內建的版本。
// 出國沒網路時，就用上次存下來的那份。
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

interface TripState {
  byId: Record<string, Versioned>
  status: 'idle' | 'loading' | 'live' | 'offline'
  refresh: () => Promise<void>
  replace: (v: Versioned) => void
}

const initial = (): Record<string, Versioned> => {
  const cache = readCache()
  return Object.fromEntries(bundled.map((t) => [t.id, cache[t.id] ?? { version: -1, trip: t }]))
}

export const useTrips = create<TripState>()((set, get) => ({
  byId: initial(),
  status: 'idle',
  refresh: async () => {
    set({ status: 'loading' })
    try {
      const { trips } = await fetchTrips()
      const byId = { ...get().byId }
      for (const v of trips) byId[v.trip.id] = v
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
export const useTripList = () => useTrips(useShallow((s) => bundled.map((t) => s.byId[t.id]?.trip ?? t)))
