import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Clock, LifeBuoy, Wallet } from 'lucide-react'
import type { Route, Trip } from '../types'
import { Card, Chip, Verify, WhoChip, gradient } from './ui'
import { Train } from './illustrations'

function RouteCard({ route, trip, highlighted }: { route: Route; trip: Trip; highlighted: boolean }) {
  const [active, setActive] = useState(() => Math.max(0, route.options.findIndex((o) => o.recommended)))
  const option = route.options[active]

  return (
    <Card id={`route-${route.id}`} className={`scroll-mt-20 ${highlighted ? 'ring-[3px] ring-peach' : ''}`}>
      {route.who && (
        <div className="mb-1.5 flex gap-1.5">
          {route.who.map((id) => {
            const t = trip.travelers.find((x) => x.id === id)
            return t && <WhoChip key={id} traveler={t} />
          })}
        </div>
      )}
      <h2 className="text-lg font-black">{route.title}</h2>
      {route.when && <p className="text-xs font-bold text-peach-ink">{route.when}</p>}
      <p className="mt-2 text-sm leading-relaxed text-mute">{route.summary}</p>

      <div className="mt-4 grid gap-1 rounded-2xl bg-cream p-1" style={{ gridTemplateColumns: `repeat(${route.options.length}, 1fr)` }}>
        {route.options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setActive(i)}
            className="relative rounded-xl px-1 py-2 text-xs font-extrabold"
          >
            {i === active && (
              <motion.span
                layoutId={`opt-${route.id}`}
                className={`absolute inset-0 rounded-xl ${gradient}`}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
              />
            )}
            <span className={`relative ${i === active ? 'text-ink' : 'text-mute'}`}>
              {o.label}・{o.tab ?? o.mode}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={option.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="mt-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black">{option.mode}</h3>
            {option.recommended && <Chip tone="peach">推薦</Chip>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mute">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" />
              {option.duration}
            </span>
            <span className="inline-flex items-center gap-1">
              <Wallet className="size-4" />
              {option.cost}
            </span>
          </div>

          <ol className="mt-4 space-y-3">
            {option.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky/40 text-xs font-black text-sky-ink">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          {(option.pros || option.cons) && (
            <div className="mt-4 grid gap-2 text-sm">
              {option.pros?.map((p) => (
                <p key={p} className="font-bold text-sky-ink">＋ {p}</p>
              ))}
              {option.cons?.map((c) => (
                <p key={c} className="font-bold text-peach-ink">－ {c}</p>
              ))}
            </div>
          )}
          {option.verify && <Verify>{option.verify}</Verify>}
        </motion.div>
      </AnimatePresence>

      {route.fallback && (
        <div className="mt-5 rounded-2xl bg-cream p-3.5">
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-black">
            <LifeBuoy className="size-4 text-peach-ink" />
            出狀況時
          </p>
          <ul className="space-y-1.5 text-sm leading-relaxed text-mute">
            {route.fallback.map((f) => (
              <li key={f}>・{f}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

export default function RoutesView({ trip, focus }: { trip: Trip; focus?: string }) {
  useEffect(() => {
    if (!focus) return window.scrollTo({ top: 0 })
    const t = setTimeout(() => document.getElementById(`route-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 220)
    return () => clearTimeout(t)
  }, [focus])

  return (
    <div className="space-y-4 pt-2">
      <div className="soft-shadow flex items-center gap-3 overflow-hidden rounded-[2rem] bg-cream px-5 py-3">
        <div className="flex-1">
          <h2 className="text-xl font-black">交通指南</h2>
          <p className="text-xs font-bold text-mute">每段都有推薦方案和出狀況時的備案</p>
        </div>
        <Train className="-my-3 w-24" />
      </div>
      {trip.routes.map((r) => (
        <RouteCard key={r.id} route={r} trip={trip} highlighted={r.id === focus} />
      ))}
    </div>
  )
}
