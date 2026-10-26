import { useSyncExternalStore } from 'react'

// hash 路由：GitHub Pages 這類純靜態主機不需要 rewrite 設定
export const tabs = ['plan', 'routes', 'places', 'info', 'list'] as const
export type Tab = (typeof tabs)[number]

export interface RouteState {
  tripId?: string
  tab: Tab
  focus?: string
}

const isTab = (s: string | undefined): s is Tab => tabs.includes(s as Tab)

function parse(hash: string): RouteState {
  const [head, tripId, tab, focus] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  if (head !== 'trip' || !tripId) return { tab: 'plan' }
  return { tripId, tab: isTab(tab) ? tab : 'plan', focus }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parse(hash)
}

export function href(tripId?: string, tab: Tab = 'plan', focus?: string) {
  if (!tripId) return '#/'
  return ['#', 'trip', tripId, tab, focus].filter(Boolean).join('/')
}
