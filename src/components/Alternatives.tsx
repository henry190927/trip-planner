import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BatteryLow,
  ChevronDown,
  CloudRain,
  DoorClosed,
  FastForward,
  Hourglass,
  LoaderCircle,
  Shuffle,
  Split,
  Undo2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Alternative, Item, Trigger, Trip } from '../types'
import { useChat } from '../lib/chatStore'
import { triggerLabels } from '../lib/triggers'
import { MapButton } from './ui'

export const triggerIcons: Record<Trigger, LucideIcon> = {
  full: Users,
  closed: DoorClosed,
  rain: CloudRain,
  tired: BatteryLow,
  early: FastForward,
  late: Hourglass,
  other: Shuffle,
}

export function TriggerChip({ trigger, when, original }: { trigger: Trigger; when?: string; original?: boolean }) {
  const Icon = original ? Undo2 : triggerIcons[trigger]
  const text = original ? '原本的安排' : trigger === 'other' && when ? when : `${triggerLabels[trigger]}${when ? `・${when}` : ''}`
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-butter px-2 py-0.5 text-[11px] font-bold text-[#a8661c]">
      <Icon className="size-3" />
      {text}
    </span>
  )
}

function AlternativeRow({ alt, index, item, date, trip }: { alt: Alternative; index: number; item: Item; date: string; trip: Trip }) {
  const applyDirect = useChat((s) => s.applyDirect)
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy'>('idle')
  const [error, setError] = useState('')
  const spot = alt.spotId ? trip.spots?.find((s) => s.id === alt.spotId) : undefined
  // 有連到地點清單就用清單裡那筆（確切連結可能只補在清單上）
  const place = spot?.place ?? alt.place

  const use = async () => {
    setStep('busy')
    setError('')
    try {
      const summary = alt.original ? `換回原本的安排：${alt.title}` : `改用備案（${triggerLabels[alt.trigger]}）：${alt.title}`
      await applyDirect(trip.id, [{ op: 'use_alternative', date, title: item.title, time: item.time, index }], summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStep('idle')
    }
  }

  return (
    <li className="rounded-2xl bg-cream/70 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <TriggerChip trigger={alt.trigger} when={alt.when} original={alt.original} />
        {alt.time && alt.time !== item.time && <span className="text-[11px] font-bold text-mute">改到 {alt.time}</span>}
      </div>
      <p className="mt-1 text-sm font-extrabold leading-snug">{alt.title}</p>
      {place?.local && <p className="text-xs font-bold text-mute">{place.local}</p>}
      {(spot?.hours || spot?.access) && (
        <p className="mt-0.5 text-xs text-mute">{[spot.hours, spot.access].filter(Boolean).join('・')}</p>
      )}
      {alt.note && <p className="mt-1 text-xs leading-relaxed text-mute">{alt.note}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {place && <MapButton provider={trip.mapProvider} place={place} compact />}
        {step === 'idle' && (
          <button
            type="button"
            onClick={() => setStep('confirm')}
            className="inline-flex items-center gap-1 rounded-full bg-peach/50 px-3 py-1.5 text-xs font-bold text-peach-ink active:scale-95"
          >
            <Split className="size-3.5" />
            {alt.original ? '換回原本的' : '改用這個'}
          </button>
        )}
        {step === 'confirm' && (
          <>
            <button
              type="button"
              onClick={() => void use()}
              className="rounded-full bg-[linear-gradient(135deg,var(--sky),var(--peach))] px-3 py-1.5 text-xs font-black active:scale-95"
            >
              確定換成「{alt.title}」
            </button>
            <button type="button" onClick={() => setStep('idle')} className="rounded-full px-2 py-1.5 text-xs font-bold text-mute">
              取消
            </button>
          </>
        )}
        {step === 'busy' && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-mute">
            <LoaderCircle className="size-3.5 animate-spin" />
            換成備案中…
          </span>
        )}
      </div>
      {error && <p className="mt-2 rounded-xl bg-peach/40 px-2.5 py-1.5 text-xs font-bold text-peach-ink">{error}</p>}
    </li>
  )
}

/** 行程項目下方的備案：平常收起來，遇到狀況（scenario）時自動展開對應的那幾個 */
export default function Alternatives({ item, date, trip, scenario }: { item: Item; date: string; trip: Trip; scenario?: Trigger }) {
  const alts = item.alternatives ?? []
  // 使用者手動打開或收起過就照他的；沒動過時，遇到狀況（scenario）有對應的備案就自動展開
  const [override, setOverride] = useState<'open' | 'closed'>()
  const [lastScenario, setLastScenario] = useState(scenario)
  if (scenario !== lastScenario) {
    setLastScenario(scenario)
    setOverride(undefined)
  }
  if (!alts.length) return null
  const all = alts.map((a, i) => ({ a, i }))
  const matching = scenario ? all.filter(({ a }) => a.trigger === scenario && !a.original) : []
  const expanded = override ? override === 'open' : matching.length > 0
  // 自動展開時只列對應的；手動打開就列全部
  const shown = override === 'open' || !matching.length ? all : matching

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOverride(expanded ? 'closed' : 'open')}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink active:scale-95"
      >
        <Split className="size-3.5" />
        {item.usedAlternative ? `其他安排 ${alts.length}` : `備案 ${alts.length}`}
        <ChevronDown className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 space-y-2 overflow-hidden"
          >
            {shown.map(({ a, i }) => (
              <AlternativeRow key={i} alt={a} index={i} item={item} date={date} trip={trip} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
