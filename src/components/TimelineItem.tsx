import {
  ArrowRight,
  BedDouble,
  EyeOff,
  Camera,
  Hourglass,
  Lock,
  ChevronRight,
  ClipboardList,
  Plane,
  ShoppingBag,
  Ticket,
  TrainFront,
  UtensilsCrossed,
} from 'lucide-react'
import type { Item, ItemKind, Trigger, Trip } from '../types'
import { href } from '../lib/router'
import { Chip, MapButton, WhoChip } from './ui'
import DriverCard from './DriverCard'
import Alternatives, { TriggerChip } from './Alternatives'
import { isFixed } from '../lib/plan'
import TaskCheck from './TaskCheck'
import { Bowl, Lightstick, ShoppingBag as BagArt } from './illustrations'

const kinds: Record<ItemKind, { Icon: typeof Plane; bg: string }> = {
  flight: { Icon: Plane, bg: 'var(--sky)' },
  transit: { Icon: TrainFront, bg: 'var(--sky)' },
  stay: { Icon: BedDouble, bg: 'var(--butter)' },
  food: { Icon: UtensilsCrossed, bg: 'var(--peach)' },
  sight: { Icon: Camera, bg: 'var(--butter)' },
  shopping: { Icon: ShoppingBag, bg: 'var(--peach)' },
  concert: { Icon: Ticket, bg: 'var(--peach)' },
  task: { Icon: ClipboardList, bg: 'var(--cream)' },
}

// 重點項目在卡片右側放一張小插圖
const accentArt: Partial<Record<ItemKind, typeof Lightstick>> = {
  concert: Lightstick,
  food: Bowl,
  shopping: BagArt,
}

export default function TimelineItem({
  item,
  trip,
  last,
  state,
  date,
  scenario,
}: {
  item: Item
  trip: Trip
  last: boolean
  state?: 'now' | 'next'
  date: string
  /** 選了「遇到狀況」時：沒有對應備案的項目淡化 */
  scenario?: Trigger
}) {
  // 有連到地點清單就用清單裡那筆（在地點清單補的確切連結，行程卡片上也會用到）
  const mapPlace = (item.spotId && trip.spots?.find((s) => s.id === item.spotId)?.place) || item.place
  const dimmed = scenario && !item.alternatives?.some((a) => a.trigger === scenario && !a.original)
  const { Icon, bg } = kinds[item.kind]
  const Art = item.tentative ? undefined : accentArt[item.kind]
  const who = item.who?.map((id) => trip.travelers.find((t) => t.id === id)).filter((t) => t !== undefined)

  return (
    <li className={`relative flex gap-3 transition-opacity ${dimmed ? 'opacity-40' : ''}`} data-scenario-match={scenario && !dimmed ? '' : undefined}>
      <div className="w-12 shrink-0 pt-3.5 text-right">
        <p className="text-sm font-black tabular-nums">{item.time ?? ''}</p>
        {item.end && <p className="text-[11px] font-bold tabular-nums text-mute">{item.end}</p>}
      </div>

      <div className="relative flex w-8 shrink-0 flex-col items-center">
        <span
          className="relative z-[1] mt-2.5 flex size-8 items-center justify-center rounded-full border-2 border-card text-ink"
          style={{ background: bg }}
        >
          <Icon className="size-4" strokeWidth={2.2} />
          {state === 'now' && <span className="absolute inset-0 animate-ping rounded-full bg-peach" />}
        </span>
        {!last && <span className="w-0.5 flex-1 rounded-full bg-butter" />}
      </div>

      <div
        className={`relative mb-3 min-w-0 flex-1 overflow-hidden rounded-3xl p-3.5 ${
          item.tentative ? 'border-2 border-dashed border-butter bg-cream/50' : 'soft-shadow bg-card'
        } ${state === 'now' ? 'ring-[3px] ring-peach' : ''}`}
      >
        {Art && <Art className="pointer-events-none absolute -right-3 -top-2 w-20 opacity-90" />}
        <div className={`flex flex-wrap items-center gap-1.5 ${Art ? 'pr-14' : ''}`}>
          {state === 'now' && <Chip tone="peach">現在</Chip>}
          {state === 'next' && <Chip tone="sky">下一個</Chip>}
          {who?.map((t) => <WhoChip key={t.id} traveler={t} />)}
          {item.tzLabel && <Chip>{item.tzLabel}時間</Chip>}
          {item.tentative && <Chip tone="warn">建議</Chip>}
          {item.private && (
            <Chip tone="peach">
              <EyeOff className="size-3" />
              私人
            </Chip>
          )}
          {isFixed(item) && (
            <Chip>
              <Lock className="size-3" />
              固定
            </Chip>
          )}
          {item.usedAlternative && (
            <span className="inline-flex items-center gap-1">
              <span className="text-[11px] font-bold text-mute">已改用備案</span>
              <TriggerChip trigger={item.usedAlternative.trigger} when={item.usedAlternative.when} />
            </span>
          )}
        </div>
        {item.todo ? (
          <div className={`mt-1 flex flex-wrap items-start gap-2 ${Art ? 'pr-14' : ''}`}>
            <TaskCheck item={item} date={date} trip={trip} />
            <div className="min-w-0 flex-1">
              <h3 className={`font-extrabold leading-snug ${item.todo.done ? 'text-mute line-through' : ''}`}>{item.title}</h3>
              {item.todo.done && item.todo.doneAt && (
                <p className="text-[11px] font-bold text-sky-ink">
                  {new Date(item.todo.doneAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: trip.timezone })} 完成
                </p>
              )}
            </div>
          </div>
        ) : (
          <h3 className={`mt-1 font-extrabold leading-snug ${Art ? 'pr-14' : ''}`}>{item.title}</h3>
        )}
        {item.for && (
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-mute">
            <ArrowRight className="size-3.5" />
            為了：{item.for.time}「{item.for.title}」
          </p>
        )}
        {item.place?.local && <p className="text-xs font-bold text-mute">{item.place.local}</p>}
        {item.note && <p className="mt-1.5 text-sm leading-relaxed text-mute">{item.note}</p>}
        {item.verify && (
          <p className="mt-2 flex gap-1 text-xs font-bold text-[#a8661c]">
            <Hourglass className="mt-px size-3.5 shrink-0" />
            {item.verify}
          </p>
        )}

        {(item.place || item.routeId) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {mapPlace && <MapButton provider={trip.mapProvider} place={mapPlace} compact />}
            {item.place && <DriverCard place={item.place} phrase={trip.driverPhrase} />}
            {item.routeId && (
              <a
                href={href(trip.id, 'routes', item.routeId)}
                className="inline-flex items-center gap-0.5 rounded-full bg-peach/50 px-3 py-1.5 text-xs font-bold text-peach-ink active:scale-95"
              >
                交通指南
                <ChevronRight className="size-3.5" />
              </a>
            )}
          </div>
        )}
        <Alternatives item={item} date={date} trip={trip} scenario={scenario} />
      </div>
    </li>
  )
}
