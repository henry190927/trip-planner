import { useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import type { Trip } from '../types'
import { formatDate, weekday, type TripPhase, type ZonedNow } from '../lib/time'
import TimelineItem from './TimelineItem'

const swipe = { distance: 60, velocity: 400 }

export default function DayView({ trip, now, phase }: { trip: Trip; now: ZonedNow; phase: TripPhase }) {
  const [index, setIndex] = useState(() => (phase.kind === 'during' ? Math.min(phase.dayIndex, trip.days.length - 1) : 0))
  const [direction, setDirection] = useState(0)
  const day = trip.days[index]

  const go = (next: number) => {
    if (next < 0 || next >= trip.days.length || next === index) return
    setDirection(next > index ? 1 : -1)
    setIndex(next)
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -swipe.distance || info.velocity.x < -swipe.velocity) go(index + 1)
    else if (info.offset.x > swipe.distance || info.velocity.x > swipe.velocity) go(index - 1)
  }

  // 「現在」與「下一個」：只在當天、且時間是旅程當地時區的項目上判斷
  const isToday = now.date === day.date
  const timed = day.items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => item.time && /^\d{2}:\d{2}$/.test(item.time) && !item.tzLabel)
  const currentIdx = isToday ? timed.filter(({ item }) => item.time! <= now.time).at(-1)?.i : undefined
  const nextIdx = isToday ? timed.find(({ item }) => item.time! > now.time)?.i : undefined

  return (
    <>
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 bg-paper/85 px-4 py-3 backdrop-blur-xl">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {trip.days.map((d, i) => {
            const active = i === index
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => go(i)}
                className={`relative shrink-0 rounded-2xl px-4 py-2 text-left transition-colors ${
                  active ? 'text-white' : 'bg-card text-ink'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="day-pill"
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))' }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
                  />
                )}
                <span className="relative block text-[11px] font-semibold opacity-80">
                  DAY {i + 1}・{weekday(d.date)}
                </span>
                <span className="relative block text-base font-bold tabular-nums">{formatDate(d.date, false)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={day.date}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ x: dir * 60, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (dir: number) => ({ x: dir * -60, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            dragDirectionLock
            onDragEnd={onDragEnd}
            className="touch-pan-y"
          >
            <div className="mb-4 mt-2 px-1">
              <h2 className="text-2xl font-bold">{day.title}</h2>
              <p className="text-sm text-mute">{formatDate(day.date)}</p>
            </div>
            <ol>
              {day.items.map((item, i) => (
                <TimelineItem
                  key={i}
                  item={item}
                  trip={trip}
                  last={i === day.items.length - 1}
                  state={i === currentIdx ? 'now' : i === nextIdx ? 'next' : undefined}
                />
              ))}
            </ol>
            <p className="mt-6 text-center text-xs text-mute">左右滑動切換天數</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
