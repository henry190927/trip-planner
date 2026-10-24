import type { ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import type { MapProvider, Place } from '../types'
import { mapLabel, mapUrl } from '../lib/maps'

export function Chip({ children, tone = 'mute' }: { children: ReactNode; tone?: 'mute' | 'accent' | 'warn' }) {
  const tones = {
    mute: 'bg-line/70 text-mute',
    accent: 'bg-accent/12 text-accent',
    warn: 'bg-amber-400/15 text-amber-700 dark:text-amber-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Card({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_rgb(0_0_0/0.04)] ${className}`}>
      {children}
    </section>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-7 px-1 text-xs font-semibold tracking-widest text-mute">{children}</h2>
}

export function MapButton({ provider, place, compact }: { provider: MapProvider; place: Place; compact?: boolean }) {
  return (
    <a
      href={mapUrl(provider, place)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-3 py-1.5 text-xs font-semibold text-accent active:scale-95"
    >
      <MapPin className="size-3.5" />
      {compact ? '地圖' : `開 ${mapLabel[provider]}`}
    </a>
  )
}

export function Verify({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 rounded-xl bg-amber-400/12 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
      <span className="font-bold">待確認・</span>
      {children}
    </p>
  )
}
