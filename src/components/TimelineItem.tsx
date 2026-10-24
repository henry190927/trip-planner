import {
  BedDouble,
  Camera,
  ChevronRight,
  ClipboardList,
  Plane,
  ShoppingBag,
  Ticket,
  TrainFront,
  UtensilsCrossed,
} from 'lucide-react'
import type { Item, ItemKind, Trip } from '../types'
import { href } from '../lib/router'
import { Chip, MapButton } from './ui'
import DriverCard from './DriverCard'

const icons: Record<ItemKind, typeof Plane> = {
  flight: Plane,
  transit: TrainFront,
  stay: BedDouble,
  food: UtensilsCrossed,
  sight: Camera,
  shopping: ShoppingBag,
  concert: Ticket,
  task: ClipboardList,
}

export default function TimelineItem({
  item,
  trip,
  last,
  state,
}: {
  item: Item
  trip: Trip
  last: boolean
  state?: 'now' | 'next'
}) {
  const Icon = icons[item.kind]
  const highlight = item.kind === 'concert' || item.kind === 'flight'

  return (
    <li className="relative flex gap-3">
      <div className="w-12 shrink-0 pt-3.5 text-right">
        <p className="text-sm font-bold tabular-nums">{item.time ?? ''}</p>
        {item.end && <p className="text-[11px] tabular-nums text-mute">{item.end}</p>}
      </div>

      <div className="relative flex w-8 shrink-0 flex-col items-center">
        <span
          className={`relative z-[1] mt-2.5 flex size-8 items-center justify-center rounded-full ${
            highlight ? 'text-white' : 'bg-card text-accent ring-1 ring-line'
          }`}
          style={highlight ? { background: 'linear-gradient(135deg, var(--accent), var(--accent2))' } : undefined}
        >
          <Icon className="size-4" />
          {state === 'now' && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
        </span>
        {!last && <span className="w-px flex-1 bg-line" />}
      </div>

      <div
        className={`mb-3 min-w-0 flex-1 rounded-2xl bg-card p-3.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ${
          state === 'now' ? 'ring-2 ring-accent' : ''
        } ${item.tentative ? 'border border-dashed border-line bg-transparent shadow-none' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {state === 'now' && <Chip tone="accent">現在</Chip>}
          {state === 'next' && <Chip>下一個</Chip>}
          {item.tzLabel && <Chip>{item.tzLabel}時間</Chip>}
          {item.tentative && <Chip>建議</Chip>}
        </div>
        <h3 className="mt-1 font-semibold leading-snug">{item.title}</h3>
        {item.place?.local && <p className="text-xs text-mute">{item.place.local}</p>}
        {item.note && <p className="mt-1.5 text-sm leading-relaxed text-mute">{item.note}</p>}
        {item.verify && (
          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">⏳ {item.verify}</p>
        )}

        {(item.place || item.routeId) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.place && <MapButton provider={trip.mapProvider} place={item.place} compact />}
            {item.place && <DriverCard place={item.place} phrase={trip.driverPhrase} />}
            {item.routeId && (
              <a
                href={href(trip.id, 'routes', item.routeId)}
                className="inline-flex items-center gap-0.5 rounded-full bg-line/70 px-3 py-1.5 text-xs font-semibold active:scale-95"
              >
                交通指南
                <ChevronRight className="size-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
