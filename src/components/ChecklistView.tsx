import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import type { Trip } from '../types'
import { useStoredSet } from '../lib/storage'
import { Card, SectionTitle } from './ui'

export default function ChecklistView({ trip }: { trip: Trip }) {
  const [done, toggle] = useStoredSet(`checklist:${trip.id}`)
  const total = trip.checklist.reduce((n, g) => n + g.items.length, 0)
  const checked = trip.checklist.reduce((n, g) => n + g.items.filter((i) => done.has(i.id)).length, 0)

  useEffect(() => window.scrollTo({ top: 0 }), [])

  return (
    <div className="pt-4">
      <Card>
        <div className="flex items-baseline justify-between">
          <p className="font-bold">出發前準備</p>
          <p className="text-sm tabular-nums text-mute">
            {checked} / {total}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent2))' }}
            animate={{ width: `${total ? (checked / total) * 100 : 0}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
          />
        </div>
        <p className="mt-2 text-xs text-mute">勾選紀錄只存在這支手機上。</p>
      </Card>

      {trip.checklist.map((group) => (
        <div key={group.title}>
          <SectionTitle>{group.title}</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {group.items.map((item) => {
              const on = done.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-line/40"
                >
                  <motion.span
                    animate={{ scale: on ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.25 }}
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      on ? 'border-transparent text-white' : 'border-line'
                    }`}
                    style={on ? { background: 'linear-gradient(135deg, var(--accent), var(--accent2))' } : undefined}
                  >
                    {on && <Check className="size-4" strokeWidth={3} />}
                  </motion.span>
                  <span className={`text-sm transition-colors ${on ? 'text-mute line-through' : ''}`}>{item.label}</span>
                </button>
              )
            })}
          </Card>
        </div>
      ))}
    </div>
  )
}
