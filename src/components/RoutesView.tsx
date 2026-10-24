import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Clock, LifeBuoy, Wallet } from 'lucide-react'
import type { Route, Trip } from '../types'
import { Card, Chip, Verify } from './ui'

function RouteCard({ route, highlighted }: { route: Route; highlighted: boolean }) {
  const [active, setActive] = useState(() => Math.max(0, route.options.findIndex((o) => o.recommended)))
  const option = route.options[active]

  return (
    <Card id={`route-${route.id}`} className={`scroll-mt-20 ${highlighted ? 'ring-2 ring-accent' : ''}`}>
      <h2 className="text-lg font-bold">{route.title}</h2>
      {route.when && <p className="text-xs font-medium text-accent">{route.when}</p>}
      <p className="mt-2 text-sm leading-relaxed text-mute">{route.summary}</p>

      <div className="mt-4 grid gap-1 rounded-xl bg-line/60 p-1" style={{ gridTemplateColumns: `repeat(${route.options.length}, 1fr)` }}>
        {route.options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setActive(i)}
            className="relative rounded-lg px-1 py-2 text-xs font-semibold"
          >
            {i === active && (
              <motion.span
                layoutId={`opt-${route.id}`}
                className="absolute inset-0 rounded-lg bg-card shadow-sm"
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
            <h3 className="font-bold">{option.mode}</h3>
            {option.recommended && <Chip tone="accent">推薦</Chip>}
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
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/12 text-xs font-bold text-accent">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          {(option.pros || option.cons) && (
            <div className="mt-4 grid gap-2 text-sm">
              {option.pros?.map((p) => (
                <p key={p} className="text-emerald-700 dark:text-emerald-300">＋ {p}</p>
              ))}
              {option.cons?.map((c) => (
                <p key={c} className="text-rose-700 dark:text-rose-300">－ {c}</p>
              ))}
            </div>
          )}
          {option.verify && <Verify>{option.verify}</Verify>}
        </motion.div>
      </AnimatePresence>

      {route.fallback && (
        <div className="mt-5 rounded-xl border border-line p-3">
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold">
            <LifeBuoy className="size-4 text-accent" />
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
    <div className="space-y-4 pt-4">
      {trip.routes.map((r) => (
        <RouteCard key={r.id} route={r} highlighted={r.id === focus} />
      ))}
    </div>
  )
}
