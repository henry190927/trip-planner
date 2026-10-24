import { useCallback, useState } from 'react'

// localStorage 在私密瀏覽或被封鎖時會丟例外，讀寫都要包起來
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 存不了就只留在記憶體
  }
}

export function useStoredSet(key: string) {
  const [set, setSet] = useState(() => new Set(read<string[]>(key, [])))
  const toggle = useCallback(
    (id: string) =>
      setSet((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        write(key, [...next])
        return next
      }),
    [key],
  )
  return [set, toggle] as const
}
