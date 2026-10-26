import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// 只存這支手機自己的偏好：看誰的行程、清單勾了哪些、行程動態看到哪一版
interface PrefsState {
  /** tripId → 只看某位旅伴（undefined = 全部） */
  viewer: Record<string, string | undefined>
  /** tripId → 已勾選的清單項目 id */
  checked: Record<string, string[]>
  /** tripId → 行程動態已經看到第幾版 */
  seen: Record<string, number>
  setViewer: (tripId: string, travelerId: string | undefined) => void
  markSeen: (tripId: string, version: number) => void
  toggleChecked: (tripId: string, itemId: string) => void
}

// localStorage 在私密瀏覽或被封鎖時會丟例外，存不了就只留在記憶體
export const safeStorage = createJSONStorage(() => {
  try {
    localStorage.setItem('__probe', '1')
    localStorage.removeItem('__probe')
    return localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    }
  }
})

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      viewer: {},
      checked: {},
      seen: {},
      markSeen: (tripId, version) => set((s) => (version > (s.seen[tripId] ?? -1) ? { seen: { ...s.seen, [tripId]: version } } : s)),
      setViewer: (tripId, travelerId) => set((s) => ({ viewer: { ...s.viewer, [tripId]: travelerId } })),
      toggleChecked: (tripId, itemId) =>
        set((s) => {
          const cur = s.checked[tripId] ?? []
          const next = cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId]
          return { checked: { ...s.checked, [tripId]: next } }
        }),
    }),
    { name: 'trip-prefs', storage: safeStorage, version: 1 },
  ),
)
