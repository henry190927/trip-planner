import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, ChevronLeft, Info, ListChecks, Route as RouteIcon } from 'lucide-react'
import type { Trip } from '../types'
import { href, type Tab } from '../lib/router'
import { formatDate, tripPhase, useNow } from '../lib/time'
import DayView from './DayView'
import RoutesView from './RoutesView'
import InfoView from './InfoView'
import ChecklistView from './ChecklistView'
import ChatSheet from './ChatSheet'

const nav: { tab: Tab; label: string; Icon: typeof CalendarDays }[] = [
  { tab: 'plan', label: '行程', Icon: CalendarDays },
  { tab: 'routes', label: '交通', Icon: RouteIcon },
  { tab: 'info', label: '資訊', Icon: Info },
  { tab: 'list', label: '清單', Icon: ListChecks },
]

export default function TripView({ trip, tab, focus }: { trip: Trip; tab: Tab; focus?: string }) {
  const now = useNow(trip.timezone)
  const phase = tripPhase(trip, now.date)

  const status =
    phase.kind === 'before' ? `${phase.days} 天後出發` : phase.kind === 'during' ? `旅行中・Day ${phase.dayIndex + 1}` : '已結束'

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <header className="pt-safe sticky top-0 z-20 bg-paper/85 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-2 px-2">
          <a href={href()} aria-label="回首頁" className="flex size-10 items-center justify-center rounded-full active:bg-cream">
            <ChevronLeft className="size-6" />
          </a>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black leading-tight">
              {trip.emoji} {trip.title}
              <span className="ml-1.5 text-sm font-bold text-mute">{trip.subtitle}</span>
            </h1>
            <p className="text-xs font-bold text-peach-ink">
              {formatDate(trip.startDate, false)} – {formatDate(trip.endDate, false)}・{status}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 pb-28">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'plan' && <DayView trip={trip} now={now} phase={phase} />}
            {tab === 'routes' && <RoutesView trip={trip} focus={focus} />}
            {tab === 'info' && <InfoView trip={trip} />}
            {tab === 'list' && <ChecklistView trip={trip} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <ChatSheet trip={trip} />

      <nav className="pb-safe fixed bottom-0 left-1/2 z-30 w-full max-w-(--frame) -translate-x-1/2 px-4">
        <div className="soft-shadow mx-auto grid max-w-md grid-cols-4 rounded-[1.75rem] bg-card/90 p-1.5 backdrop-blur-xl">
          {nav.map(({ tab: t, label, Icon }) => {
            const active = t === tab
            return (
              <a
                key={t}
                href={href(trip.id, t)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 rounded-3xl py-1.5 text-[11px] font-bold transition-colors ${
                  active ? 'text-ink' : 'text-mute'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-3xl bg-[linear-gradient(135deg,var(--sky),var(--peach))]"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                  />
                )}
                <Icon className="relative size-6" strokeWidth={active ? 2.4 : 1.9} />
                <span className="relative">{label}</span>
              </a>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
