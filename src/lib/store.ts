import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// 只存這支手機自己的偏好：看誰的行程、行程動態看到哪一版、收起來的區塊
interface PrefsState {
  /** tripId → 只看某位旅伴（undefined = 全部） */
  viewer: Record<string, string | undefined>
  /** 舊版存在手機上的清單勾選（tripId → 項目 id）；現在勾選存在行程裡，這份只用來搬過去一次 */
  checked: Record<string, string[]>
  /** tripId → 行程動態已經看到第幾版 */
  seen: Record<string, number>
  /** 收起來的區塊（例如 `${tripId}:planned`） */
  collapsed: string[]
  toggleCollapsed: (key: string) => void
  setViewer: (tripId: string, travelerId: string | undefined) => void
  markSeen: (tripId: string, version: number) => void
  clearChecked: (tripId: string) => void
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
      collapsed: [],
      toggleCollapsed: (key) =>
        set((s) => ({ collapsed: s.collapsed.includes(key) ? s.collapsed.filter((k) => k !== key) : [...s.collapsed, key] })),
      markSeen: (tripId, version) => set((s) => (version > (s.seen[tripId] ?? -1) ? { seen: { ...s.seen, [tripId]: version } } : s)),
      setViewer: (tripId, travelerId) => set((s) => ({ viewer: { ...s.viewer, [tripId]: travelerId } })),
      clearChecked: (tripId) =>
        set((s) => {
          const { [tripId]: _, ...rest } = s.checked
          return { checked: rest }
        }),
    }),
    { name: 'trip-prefs', storage: safeStorage, version: 1 },
  ),
)
