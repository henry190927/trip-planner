import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, ChevronRight, Minus, Pencil, Plus, RotateCcw, X } from 'lucide-react'
import type { Trip } from '../types'
import type { Change, LogEntry } from '../lib/api'
import { useChat } from '../lib/chatStore'
import { relativeTime } from '../lib/dates'
import { href } from '../lib/router'
import { usePrefs } from '../lib/store'
import { useTrips } from '../lib/tripStore'
import { Chip } from './ui'
import { Sprout } from './illustrations'

const noLog: LogEntry[] = []

const sources: Record<LogEntry['source'], { label: string; tone: 'peach' | 'mute' | 'sky' }> = {
  ai: { label: '小樹的修改', tone: 'peach' },
  undo: { label: '復原', tone: 'mute' },
  sync: { label: '同步更新', tone: 'sky' },
}

const kinds: Record<Change['kind'], { Icon: typeof Plus; className: string; label: string }> = {
  add: { Icon: Plus, className: 'bg-sky/40 text-sky-ink', label: '新增' },
  update: { Icon: Pencil, className: 'bg-butter text-[#a8661c]', label: '修改' },
  remove: { Icon: Minus, className: 'bg-peach/50 text-peach-ink', label: '刪除' },
}

function ChangeRow({ change, tripId, onJump }: { change: Change; tripId: string; onJump: () => void }) {
  const { Icon, className, label } = kinds[change.kind]
  const body = (
    <>
      <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${className}`} aria-label={label}>
        <Icon className="size-3" strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1 text-left">{change.text}</span>
      {change.date && <ChevronRight className="mt-0.5 size-4 shrink-0 text-mute" />}
    </>
  )
  if (!change.date) return <li className="flex gap-2 py-1 text-sm">{body}</li>
  return (
    <li>
      <a href={href(tripId, 'plan', change.date)} onClick={onJump} className="-mx-2 flex gap-2 rounded-xl px-2 py-1 text-sm active:bg-cream">
        {body}
      </a>
    </li>
  )
}

export default function ActivityBell({ trip }: { trip: Trip }) {
  const log = useTrips((s) => s.byId[trip.id]?.log) ?? noLog
  const seen = usePrefs((s) => s.seen[trip.id])
  const markSeen = usePrefs((s) => s.markSeen)
  const passcode = useChat((s) => s.passcode)
  const undo = useChat((s) => s.undo)
  const [open, setOpen] = useState(false)
  // 打開時記下「之前看到哪」，面板裡才標得出哪些是新的
  const [seenAtOpen, setSeenAtOpen] = useState<number>()
  const [notice, setNotice] = useState('')
  const latest = log[0]?.version

  // 第一次在這台裝置打開：之前的紀錄都算看過，不要一次跳出一大堆
  useEffect(() => {
    if (seen === undefined && latest !== undefined) markSeen(trip.id, latest)
  }, [seen, latest, markSeen, trip.id])

  const unread = seen === undefined ? 0 : log.filter((e) => e.version > seen).length

  const show = () => {
    setSeenAtOpen(seen)
    setOpen(true)
    if (latest !== undefined) markSeen(trip.id, latest)
  }

  const onUndo = async () => {
    try {
      await undo(trip.id)
      setNotice('已復原這次修改')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e))
    }
    setTimeout(() => setNotice(''), 4000)
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={show}
        aria-label={unread ? `行程動態，${unread} 則新的` : '行程動態'}
        whileTap={{ scale: 0.9 }}
        className="relative flex size-10 items-center justify-center rounded-full active:bg-cream"
      >
        <motion.span
          key={unread}
          animate={unread ? { rotate: [0, -16, 14, -10, 6, 0] } : undefined}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex"
        >
          <Bell className="size-6" />
        </motion.span>
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-peach-ink px-1 text-[10px] font-black text-white"
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </motion.button>

      {/* 鈴鐺在頁首裡，頁首的毛玻璃（backdrop-filter）會讓 fixed 元素以頁首為準定位，所以面板要畫到 body 底下 */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-ink/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
              />
              <motion.section
                role="dialog"
                aria-label="行程動態"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', bounce: 0.12, duration: 0.45 }}
                className="pb-safe fixed bottom-0 left-1/2 z-50 flex max-h-[80dvh] w-full max-w-(--frame) -translate-x-1/2 flex-col rounded-t-[2rem] bg-paper"
              >
                <header className="flex items-center gap-2 border-b-2 border-cream px-4 pb-2 pt-3">
                  <Bell className="size-5 text-peach-ink" />
                  <div className="min-w-0 flex-1">
                    <p className="font-black leading-tight">行程動態</p>
                    <p className="text-[11px] font-bold text-mute">按下「套用」的修改，兩個人都看得到</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="關閉" className="flex size-9 items-center justify-center rounded-full bg-cream">
                    <X className="size-5" />
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {notice && <p className="mb-3 rounded-2xl bg-butter px-3 py-2 text-center text-sm font-bold">{notice}</p>}
                  {log.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center">
                      <Sprout className="a-sway w-20" />
                      <p className="mt-3 font-black">還沒有任何變動</p>
                      <p className="mt-1 text-sm text-mute">請小樹改行程、按下「套用」之後，會記在這裡</p>
                    </div>
                  ) : (
                    <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-0.5 before:bg-cream">
                      {log.map((entry, i) => {
                        const fresh = seenAtOpen !== undefined && entry.version > seenAtOpen
                        const source = sources[entry.source]
                        return (
                          <motion.li
                            key={entry.version}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(i, 8) * 0.04 }}
                            className="relative pl-6"
                          >
                            <span
                              className={`absolute left-0 top-4 size-4 rounded-full border-[3px] border-paper ${fresh ? 'bg-peach-ink' : 'bg-butter'}`}
                            />
                            <div className={`soft-shadow rounded-3xl bg-card px-4 py-3 ${fresh ? 'ring-2 ring-peach' : ''}`}>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Chip tone={source.tone}>{source.label}</Chip>
                                {fresh && <Chip tone="warn">新</Chip>}
                                <span className="ml-auto text-[11px] font-bold text-mute">{relativeTime(entry.at)}</span>
                              </div>
                              <p className="mt-1.5 font-black leading-snug">{entry.summary}</p>
                              {entry.changes.length > 0 && (
                                <ul className="mt-1.5">
                                  {entry.changes.map((c, j) => (
                                    <ChangeRow key={j} change={c} tripId={trip.id} onJump={() => setOpen(false)} />
                                  ))}
                                </ul>
                              )}
                              {i === 0 && passcode && entry.source !== 'sync' && (
                                <button
                                  type="button"
                                  onClick={() => void onUndo()}
                                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-bold"
                                >
                                  <RotateCcw className="size-3.5" />
                                  復原這次
                                </button>
                              )}
                            </div>
                          </motion.li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              </motion.section>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
