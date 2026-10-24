import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { trips, upcoming } from '../trips'
import { href } from '../lib/router'
import { formatDate, nowIn, tripPhase } from '../lib/time'
import type { Trip } from '../types'

function phaseText(trip: Trip) {
  const phase = tripPhase(trip, nowIn(trip.timezone).date)
  if (phase.kind === 'before') return { big: String(phase.days), small: '天後出發' }
  if (phase.kind === 'during') return { big: `Day ${phase.dayIndex + 1}`, small: '旅行中' }
  return { big: '✓', small: '已結束' }
}

export default function TripList() {
  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-lg px-4 pb-16">
      <header className="pb-6 pt-10">
        <p className="text-sm font-medium tracking-widest text-mute">TRAVEL NOTES</p>
        <h1 className="mt-1 text-3xl font-bold">旅行手帖</h1>
      </header>

      <div className="space-y-4">
        {trips.map((trip, i) => {
          const p = phaseText(trip)
          return (
            <motion.a
              key={trip.id}
              href={href(trip.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileTap={{ scale: 0.98 }}
              className="relative block overflow-hidden rounded-3xl p-6 text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${trip.theme.accent}, ${trip.theme.accent2})` }}
            >
              <div className="absolute -right-6 -top-8 text-[120px] leading-none opacity-20 select-none">{trip.emoji}</div>
              <p className="text-sm opacity-85">
                {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
              </p>
              <h2 className="mt-1 text-3xl font-bold">{trip.title}</h2>
              <p className="opacity-90">{trip.subtitle}</p>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <span className="text-4xl font-bold tabular-nums">{p.big}</span>
                  <span className="ml-1.5 text-sm opacity-90">{p.small}</span>
                </div>
                <span className="flex size-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                  <ChevronRight className="size-5" />
                </span>
              </div>
            </motion.a>
          )
        })}

        {upcoming.map((u) => (
          <div key={u.title} className="rounded-3xl border border-dashed border-line p-6">
            <p className="text-sm text-mute">{u.when}</p>
            <h2 className="mt-1 text-2xl font-bold">
              {u.emoji} {u.title}
            </h2>
            <p className="text-mute">{u.subtitle}・準備中</p>
          </div>
        ))}
      </div>
    </div>
  )
}
