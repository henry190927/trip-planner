import type { MouseEvent, ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import type { MapProvider, Place, Traveler } from '../types'
import { isPhone, mapAppUrl, mapLabel, mapUrl } from '../lib/maps'

export const gradient = 'bg-[linear-gradient(135deg,var(--sky),var(--peach))]'

export function Chip({ children, tone = 'mute' }: { children: ReactNode; tone?: 'mute' | 'sky' | 'peach' | 'warn' }) {
  const tones = {
    mute: 'bg-cream text-mute',
    sky: 'bg-sky/40 text-sky-ink',
    peach: 'bg-peach/50 text-peach-ink',
    warn: 'bg-butter text-[#a8661c]',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function WhoChip({ traveler }: { traveler: Traveler }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ background: traveler.color, color: traveler.ink }}
    >
      <span className="size-1.5 rounded-full" style={{ background: traveler.ink }} />
      {traveler.name}
    </span>
  )
}

export function Card({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`soft-shadow rounded-3xl bg-card p-4 ${className}`}>
      {children}
    </section>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-8 flex items-center gap-2 px-1 text-sm font-extrabold text-ink">
      <span className={`h-3.5 w-1.5 rounded-full ${gradient}`} />
      {children}
    </h2>
  )
}

/** 手機上先試著直接開地圖 App；沒裝 App（畫面沒有切走）就改開網頁版 */
function openMapApp(e: MouseEvent<HTMLAnchorElement>, provider: MapProvider, place: Place) {
  const app = mapAppUrl(provider, place)
  if (!app || !isPhone(navigator.userAgent)) return
  e.preventDefault()
  const web = mapUrl(provider, place)
  const fallback = setTimeout(() => {
    if (document.visibilityState === 'visible') window.location.href = web
  }, 1500)
  document.addEventListener('visibilitychange', () => clearTimeout(fallback), { once: true })
  window.location.href = app
}

export function MapButton({ provider, place, compact }: { provider: MapProvider; place: Place; compact?: boolean }) {
  return (
    <a
      href={mapUrl(provider, place)}
      onClick={(e) => openMapApp(e, provider, place)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-sky/35 px-3 py-1.5 text-xs font-bold text-sky-ink active:scale-95"
    >
      <MapPin className="size-3.5" />
      {compact ? '地圖' : `開 ${mapLabel[provider]}`}
    </a>
  )
}

export function Verify({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 rounded-2xl bg-butter px-3 py-2 text-xs leading-relaxed text-[#8a5a1c]">
      <span className="font-extrabold">待確認・</span>
      {children}
    </p>
  )
}
