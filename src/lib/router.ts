import { useSyncExternalStore } from 'react'

// hash 路由：純靜態主機不需要 rewrite 設定
export const tabs = ['plan', 'routes', 'places', 'info', 'list'] as const
export type Tab = (typeof tabs)[number]

export interface RouteState {
  tripId?: string
  tab: Tab
  focus?: string
  /** 邀請連結 #/join/<code> */
  join?: string
}

const isTab = (s: string | undefined): s is Tab => tabs.includes(s as Tab)

function parse(hash: string): RouteState {
  const [head, tripId, tab, focus] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  if (head === 'join' && tripId) return { tab: 'plan', join: tripId }
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

/** 給別人打開的邀請連結 */
export const inviteUrl = (code: string) => `${window.location.origin}${window.location.pathname}#/join/${code}`
