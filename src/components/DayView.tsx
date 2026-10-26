import { useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import type { Item, Trigger, Trip } from '../types'
import { triggers } from '../schema'
import { triggerLabels } from '../lib/triggers'
import { triggerIcons } from './Alternatives'
import { formatDate, weekday, type TripPhase, type ZonedNow } from '../lib/time'
import { usePrefs } from '../lib/store'
import TimelineItem from './TimelineItem'
import { SceneArt } from './illustrations'
import { gradient } from './ui'

const swipe = { distance: 60, velocity: 400 }

const visibleTo = (item: Item, viewer?: string) => !viewer || !item.who || item.who.includes(viewer)

function WhoFilter({ trip }: { trip: Trip }) {
  const viewer = usePrefs((s) => s.viewer[trip.id])
  const setViewer = usePrefs((s) => s.setViewer)
  const options = [{ id: undefined, name: '全部', color: 'var(--butter)', ink: 'var(--ink)' }, ...trip.travelers]

  return (
    <div className="flex gap-1 rounded-full bg-cream p-1" role="radiogroup" aria-label="看誰的行程">
      {options.map((o) => {
        const active = viewer === o.id
        return (
          <button
            key={o.name}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setViewer(trip.id, o.id)}
            className="relative rounded-full px-3 py-1 text-xs font-extrabold"
            style={{ color: active ? o.ink : 'var(--mute)' }}
          >
            {active && (
              <motion.span
                layoutId="who-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: o.color }}
                transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
              />
            )}
            <span className="relative">{o.name}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function DayView({ trip, now, phase, focus }: { trip: Trip; now: ZonedNow; phase: TripPhase; focus?: string }) {
  const focused = trip.days.findIndex((d) => d.date === focus)
  const [index, setIndex] = useState(() =>
    focused >= 0 ? focused : phase.kind === 'during' ? Math.min(phase.dayIndex, trip.days.length - 1) : 0,
  )
  const [direction, setDirection] = useState(0)
  // 網址指定了某一天（例如從行程動態點過來）就切過去；之後使用者自己滑動不受影響
  const [lastFocus, setLastFocus] = useState(focus)
  if (focus !== lastFocus) {
    setLastFocus(focus)
    if (focused >= 0 && focused !== index) {
      setDirection(focused > index ? 1 : -1)
      setIndex(focused)
    }
  }
  const viewer = usePrefs((s) => s.viewer[trip.id])
  const day = trip.days[index]
  const items = day.items.filter((item) => visibleTo(item, viewer))
  // 「遇到狀況？」：這一天有哪些情況有備案；換一天就清掉
  const [scenario, setScenario] = useState<Trigger>()
  const [scenarioDay, setScenarioDay] = useState(day.date)
  if (scenarioDay !== day.date) {
    setScenarioDay(day.date)
    setScenario(undefined)
  }
  const scenarioCounts = new Map<Trigger, number>()
  for (const item of items)
    for (const t of new Set((item.alternatives ?? []).filter((a) => !a.original).map((a) => a.trigger)))
      scenarioCounts.set(t, (scenarioCounts.get(t) ?? 0) + 1)
  const scenarios = triggers.filter((t) => scenarioCounts.has(t))

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
  const timed = items.map((item, i) => ({ item, i })).filter(({ item }) => item.time && !item.tzLabel)
  const currentIdx = isToday ? timed.filter(({ item }) => item.time! <= now.time).at(-1)?.i : undefined
  const nextIdx = isToday ? timed.find(({ item }) => item.time! > now.time)?.i : undefined

  return (
    <>
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 bg-paper/85 px-4 pb-3 pt-1 backdrop-blur-xl">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {trip.days.map((d, i) => {
            const active = i === index
            return (
              <button
                key={d.date}
                type="button"
                aria-pressed={active}
                onClick={() => go(i)}
                className={`relative shrink-0 rounded-2xl px-4 py-2 text-left ${active ? 'text-ink' : 'bg-card text-mute'}`}
              >
                {active && (
                  <motion.span
                    layoutId="day-pill"
                    className={`absolute inset-0 rounded-2xl ${gradient}`}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
                  />
                )}
                <span className="relative block text-[11px] font-extrabold opacity-80">
                  DAY {i + 1}・{weekday(d.date)}
                </span>
                <span className="relative block text-base font-black tabular-nums">{formatDate(d.date, false)}</span>
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
            <div className="soft-shadow relative mb-4 mt-1 flex items-center overflow-hidden rounded-[2rem] bg-cream p-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-peach-ink">
                  DAY {index + 1}・{formatDate(day.date)}
                </p>
                <h2 className="mt-1 text-2xl font-black leading-tight">{day.title}</h2>
                <div className="mt-3">
                  <WhoFilter trip={trip} />
                </div>
              </div>
              <SceneArt scene={day.scene} className="-my-2 -mr-2 w-28 shrink-0" />
            </div>

            {scenarios.length > 0 && (
              <div className="mb-4 rounded-3xl bg-card/70 px-3 py-2.5">
                <p className="px-1 text-xs font-extrabold text-mute">遇到狀況？點一下看有哪些備案</p>
                <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                  {scenarios.map((t) => {
                    const Icon = triggerIcons[t]
                    const active = scenario === t
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setScenario(active ? undefined : t)
                          // 捲到第一個有對應備案的項目（等展開動畫開始）
                          if (!active)
                            setTimeout(() => document.querySelector('[data-scenario-match]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
                        }}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors ${
                          active ? 'bg-ink text-paper' : 'bg-cream text-ink'
                        }`}
                      >
                        <Icon className="size-3.5" />
                        {triggerLabels[t]} {scenarioCounts.get(t)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <ol>
              {items.map((item, i) => (
                <TimelineItem
                  key={`${item.time}-${item.title}`}
                  item={item}
                  trip={trip}
                  date={day.date}
                  scenario={scenario}
                  last={i === items.length - 1}
                  state={i === currentIdx ? 'now' : i === nextIdx ? 'next' : undefined}
                />
              ))}
            </ol>
            <p className="mt-6 text-center text-xs font-bold text-mute">← 左右滑動切換天數 →</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
