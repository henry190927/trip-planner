import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, ChevronRight, CircleUserRound, CloudOff, Plus } from 'lucide-react'
import { useAuth } from '../lib/authStore'
import { useTripList, useTrips } from '../lib/tripStore'
import { href } from '../lib/router'
import { formatDate, nowIn, tripPhase } from '../lib/time'
import type { Trip } from '../types'
import { Plane, TripIcon, TwoFriends } from './illustrations'
import { gradient } from './ui'
import AccountSheet from './AccountSheet'
import ChatSheet from './ChatSheet'
import { NEW_TRIP } from '../lib/api'
import { useChat } from '../lib/chatStore'

function phaseText(trip: Trip) {
  const phase = tripPhase(trip, nowIn(trip.timezone).date)
  if (phase.kind === 'before') return { big: String(phase.days), small: '天後出發' }
  if (phase.kind === 'during') return { big: `Day ${phase.dayIndex + 1}`, small: '旅行中' }
  return { big: <Check className="inline size-7 align-[-0.2em]" strokeWidth={3} />, small: '已結束' }
}

export default function TripList() {
  const trips = useTripList()
  const status = useAuth((s) => s.status)
  const loading = useTrips((s) => s.status === 'loading' || s.status === 'idle')
  const [account, setAccount] = useState(false)
  const ask = useChat((s) => s.ask)
  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-lg px-4 pb-16">
      <div className="flex justify-end pt-3">
        {status === 'offline' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-mute">
            <CloudOff className="size-4" />
            離線中
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAccount(true)}
            aria-label="帳號"
            className="flex size-10 items-center justify-center rounded-full active:bg-cream"
          >
            <CircleUserRound className="size-6" />
          </button>
        )}
      </div>
      <header className="relative flex items-end justify-between pb-4 pt-2">
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
              <TripIcon icon={trip.icon} className="absolute -bottom-3 right-14 w-24" />
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

        {status !== 'offline' && !loading && (
          <motion.button
            type="button"
            onClick={() => ask(NEW_TRIP, '')}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center gap-3 rounded-[2rem] border-2 border-dashed border-butter bg-cream/60 p-5 text-left"
          >
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${gradient}`}>
              <Plus className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-black">{trips.length ? '用小樹建立新行程' : '建立第一趟旅行'}</span>
              <span className="block text-sm text-mute">說目的地和日期，或丟機票、訂房的截圖</span>
            </span>
          </motion.button>
        )}
        <ChatSheet floating={false} />
      </div>
      <AccountSheet open={account} onClose={() => setAccount(false)} />
    </div>
  )
}
