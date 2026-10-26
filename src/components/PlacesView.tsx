import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Clock, Coffee, Landmark, MessageCircle, ShoppingBag, Sparkles, TrainFront, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { Spot, SpotCategory, Trip } from '../types'
import { useChat } from '../lib/chatStore'
import { formatDate } from '../lib/dates'
import { openStatus, type OpenStatus } from '../lib/hours'
import { href } from '../lib/router'
import type { ZonedNow } from '../lib/time'
import { Card, Chip, MapButton, Verify } from './ui'
import { Bowl } from './illustrations'

// 分類用線條圖示與網站的色票，不用系統 emoji（各平台長得不一樣）
const categories: Record<SpotCategory, { label: string; Icon: LucideIcon; tint: string }> = {
  food: { label: '吃', Icon: UtensilsCrossed, tint: 'bg-peach/50 text-peach-ink' },
  cafe: { label: '咖啡・飲料', Icon: Coffee, tint: 'bg-butter text-[#a8661c]' },
  shopping: { label: '逛', Icon: ShoppingBag, tint: 'bg-sky/40 text-sky-ink' },
  sight: { label: '景點', Icon: Landmark, tint: 'bg-[linear-gradient(135deg,var(--sky),var(--peach))] text-ink' },
  other: { label: '其他', Icon: Sparkles, tint: 'bg-cream text-mute' },
}
const order = Object.keys(categories) as SpotCategory[]

const openBadge: Record<Exclude<OpenStatus, 'unknown'>, { label: string; tone: 'sky' | 'mute' }> = {
  open: { label: '營業中', tone: 'sky' },
  closed: { label: '休息中', tone: 'mute' },
}

interface Scheduled {
  date: string
  time?: string
}

function CategoryLabel({ category, count }: { category: SpotCategory; count: number }) {
  const { Icon, label } = categories[category]
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5" />
      {label} {count}
    </span>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors ${active ? 'bg-ink text-paper' : 'bg-card text-mute'}`}
    >
      {children}
    </button>
  )
}

function SpotCard({ spot, trip, slots, status, highlighted }: { spot: Spot; trip: Trip; slots: Scheduled[]; status: OpenStatus; highlighted: boolean }) {
  const ask = useChat((s) => s.ask)
  const cat = categories[spot.category]
  return (
    <Card id={`spot-${spot.id}`} className={highlighted ? 'ring-2 ring-peach' : ''}>
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${cat.tint}`} aria-label={cat.label}>
          <cat.Icon className="size-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-black leading-snug">{spot.place.name}</h3>
          {spot.place.local && <p className="text-xs font-bold text-mute">{spot.place.local}</p>}
        </div>
        {status !== 'unknown' && <Chip tone={openBadge[status].tone}>{openBadge[status].label}</Chip>}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {slots.length ? (
          slots.map((s) => (
            <a key={`${s.date}${s.time}`} href={href(trip.id, 'plan', s.date)}>
              <Chip tone="peach">
                已排入 {formatDate(s.date, false)}
                {s.time && ` ${s.time}`}
              </Chip>
            </a>
          ))
        ) : (
          <Chip tone="warn">口袋名單</Chip>
        )}
        {spot.area && <Chip>{spot.area}</Chip>}
        {spot.tags?.map((t) => (
          <Chip key={t}>#{t}</Chip>
        ))}
      </div>

      {(spot.hours || spot.closed || spot.access || spot.note) && (
        <div className="mt-2.5 space-y-1 text-sm leading-relaxed">
          {(spot.hours || spot.closed) && (
            <p className="flex gap-1.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-mute" />
              <span>
                {spot.hours}
                {spot.hours && spot.closed && '・'}
                {spot.closed}
                {spot.checkedAt && <span className="ml-1.5 text-[11px] font-bold text-mute">{formatDate(spot.checkedAt, false)} 確認</span>}
              </span>
            </p>
          )}
          {spot.access && (
            <p className="flex gap-1.5">
              <TrainFront className="mt-0.5 size-4 shrink-0 text-mute" />
              <span>{spot.access}</span>
            </p>
          )}
          {spot.note && <p className="text-mute">{spot.note}</p>}
        </div>
      )}
      {spot.verify && <Verify>{spot.verify}</Verify>}

      <div className="mt-3 flex flex-wrap gap-2">
        <MapButton provider={trip.mapProvider} place={spot.place} />
        {slots.length === 0 && (
          <button
            type="button"
            onClick={() => ask(trip.id, `幫我把「${spot.place.name}」排進行程`)}
            className="inline-flex items-center gap-1 rounded-full bg-peach/40 px-3 py-1.5 text-xs font-bold text-peach-ink active:scale-95"
          >
            <MessageCircle className="size-3.5" />
            請小樹排進行程
          </button>
        )}
      </div>
    </Card>
  )
}

export default function PlacesView({ trip, now, focus }: { trip: Trip; now: ZonedNow; focus?: string }) {
  const ask = useChat((s) => s.ask)
  const [category, setCategory] = useState<SpotCategory>()
  const [area, setArea] = useState<string>()
  const [openOnly, setOpenOnly] = useState(false)
  const spots = trip.spots ?? []

  useEffect(() => {
    if (!focus) {
      window.scrollTo({ top: 0 })
      return
    }
    const t = setTimeout(() => document.getElementById(`spot-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220)
    return () => clearTimeout(t)
  }, [focus])

  // 哪些地點已經排進行程、排在哪
  const scheduled = new Map<string, Scheduled[]>()
  for (const day of trip.days)
    for (const item of day.items)
      if (item.spotId) scheduled.set(item.spotId, [...(scheduled.get(item.spotId) ?? []), { date: day.date, time: item.time }])

  const status = (s: Spot) => openStatus(s.open, now.date, now.time)
  // 地區按鈕跟著分類走：只列出這個分類裡有的地區，並標數量
  const inCategory = spots.filter((s) => !category || s.category === category)
  const areaCounts = new Map<string, number>()
  for (const s of inCategory) if (s.area) areaCounts.set(s.area, (areaCounts.get(s.area) ?? 0) + 1)
  const areas = [...areaCounts.keys()]
  // 換了分類、原本選的地區在這個分類裡沒有：當作沒選
  const activeArea = area && areaCounts.has(area) ? area : undefined
  const hasHours = spots.some((s) => s.open?.length)
  const shown = spots
    .filter((s) => (!category || s.category === category) && (!activeArea || s.area === activeArea) && (!openOnly || status(s) === 'open'))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
  const firstSlot = (s: Spot) => {
    const slot = scheduled.get(s.id)?.[0]
    return slot ? `${slot.date} ${slot.time ?? ''}` : ''
  }
  const planned = shown.filter((s) => scheduled.has(s.id)).sort((a, b) => firstSlot(a).localeCompare(firstSlot(b)))
  const pocket = shown.filter((s) => !scheduled.has(s.id))

  const renderCard = (s: Spot, i: number) => (
    <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.04 }}>
      <SpotCard spot={s} trip={trip} slots={scheduled.get(s.id) ?? []} status={status(s)} highlighted={s.id === focus} />
    </motion.div>
  )

  return (
    <div className="space-y-4 pt-2">
      <div className="soft-shadow flex items-center gap-3 overflow-hidden rounded-[2rem] bg-cream px-5 py-3">
        <div className="flex-1">
          <h2 className="text-xl font-black">地點清單</h2>
          <p className="text-xs font-bold text-mute">
            已排進行程 {spots.filter((s) => scheduled.has(s.id)).length}・口袋名單 {spots.filter((s) => !scheduled.has(s.id)).length}
          </p>
        </div>
        <Bowl className="-my-2 w-20" />
      </div>

      {spots.length > 0 && (
        <div className="space-y-2">
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
            <FilterChip active={!category} onClick={() => setCategory(undefined)}>
              全部 {spots.length}
            </FilterChip>
            {order
              .filter((c) => spots.some((s) => s.category === c))
              .map((c) => (
                <FilterChip key={c} active={category === c} onClick={() => setCategory(category === c ? undefined : c)}>
                  <CategoryLabel category={c} count={spots.filter((s) => s.category === c).length} />
                </FilterChip>
              ))}
          </div>
          {(areas.length > 1 || hasHours) && (
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
              {hasHours && (
                <FilterChip active={openOnly} onClick={() => setOpenOnly(!openOnly)}>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    現在營業中
                  </span>
                </FilterChip>
              )}
              {areas.length > 1 &&
                areas.map((a) => (
                  <FilterChip key={a} active={activeArea === a} onClick={() => setArea(activeArea === a ? undefined : a)}>
                    {a} {areaCounts.get(a)}
                  </FilterChip>
                ))}
            </div>
          )}
        </div>
      )}

      {planned.length > 0 && (
        <section className="space-y-3">
          <h3 className="px-1 text-sm font-extrabold text-mute">已排進行程</h3>
          {planned.map(renderCard)}
        </section>
      )}
      {pocket.length > 0 && (
        <section className="space-y-3">
          <h3 className="px-1 text-sm font-extrabold text-mute">口袋名單</h3>
          {pocket.map(renderCard)}
        </section>
      )}
      {spots.length > 0 && shown.length === 0 && <p className="py-8 text-center text-sm font-bold text-mute">沒有符合條件的地點</p>}

      <Card className="text-center">
        <p className="font-black">{spots.length ? '還有想去的店？' : '還沒有任何地點'}</p>
        <p className="mt-1 text-sm text-mute">把店名或地圖連結丟給小樹，它會查好資料加進口袋名單</p>
        <button
          type="button"
          onClick={() => ask(trip.id, '幫我把這間加進口袋名單：')}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-peach/40 px-4 py-2 text-sm font-bold text-peach-ink active:scale-95"
        >
          <MessageCircle className="size-4" />
          丟給小樹
        </button>
      </Card>
    </div>
  )
}
