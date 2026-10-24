import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { trips, upcoming } from '../trips'
import { href } from '../lib/router'
import { formatDate, nowIn, tripPhase } from '../lib/time'
import type { Trip } from '../types'
import { Plane, Sprout, TwoFriends } from './illustrations'
import { gradient } from './ui'

function phaseText(trip: Trip) {
  const phase = tripPhase(trip, nowIn(trip.timezone).date)
  if (phase.kind === 'before') return { big: String(phase.days), small: '天後出發' }
  if (phase.kind === 'during') return { big: `Day ${phase.dayIndex + 1}`, small: '旅行中' }
  return { big: '✓', small: '已結束' }
}

export default function TripList() {
  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-lg px-4 pb-16">
      <header className="relative flex items-end justify-between pb-4 pt-8">
        <div>
          <p className="text-xs font-extrabold tracking-[0.25em] text-peach-ink">TRAVEL NOTES</p>
          <h1 className="mt-1 text-3xl font-black">旅行手帖</h1>
          <p className="mt-1 text-sm text-mute">我們兩個人的旅行</p>
        </div>
        <TwoFriends className="-mb-2 w-32" />
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
              className={`soft-shadow relative block overflow-hidden rounded-[2rem] p-6 ${gradient}`}
            >
              <Plane className="absolute -right-2 -top-3 w-28 opacity-90" />
              <Sprout className="absolute -bottom-3 right-14 w-24" />
              <p className="text-sm font-bold text-ink/70">
                {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
              </p>
              <h2 className="mt-1 text-3xl font-black">{trip.title}</h2>
              <p className="font-bold text-ink/80">{trip.subtitle}</p>
              <div className="mt-8 flex items-end justify-between">
                <div className="rounded-2xl bg-card/80 px-3 py-1.5 backdrop-blur">
                  <span className="text-3xl font-black tabular-nums">{p.big}</span>
                  <span className="ml-1.5 text-sm font-bold text-mute">{p.small}</span>
                </div>
                <span className="relative z-[1] flex size-10 items-center justify-center rounded-full bg-card/90">
                  <ChevronRight className="size-5" />
                </span>
              </div>
            </motion.a>
          )
        })}

        {upcoming.map((u) => (
          <div key={u.title} className="rounded-[2rem] border-2 border-dashed border-butter bg-cream/60 p-6">
            <p className="text-sm font-bold text-mute">{u.when}</p>
            <h2 className="mt-1 text-2xl font-black">
              {u.emoji} {u.title}
            </h2>
            <p className="text-mute">{u.subtitle}・準備中</p>
          </div>
        ))}
      </div>
    </div>
  )
}
