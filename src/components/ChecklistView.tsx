import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check, LoaderCircle, Trash2 } from 'lucide-react'
import type { Trip } from '../types'
import { useChat } from '../lib/chatStore'
import { usePrefs } from '../lib/store'
import { Card, SectionTitle, gradient } from './ui'
import { GrowingTree } from './illustrations'

const encouragement = ['種下一顆種子吧', '發芽了！', '長出葉子了', '快變成一棵樹了', '準備完成，出發！']

export default function ChecklistView({ trip }: { trip: Trip }) {
  const checked = usePrefs((s) => s.checked[trip.id])
  const toggle = usePrefs((s) => s.toggleChecked)
  const done = new Set(checked)
  const total = trip.checklist.reduce((n, g) => n + g.items.length, 0)
  const count = trip.checklist.reduce((n, g) => n + g.items.filter((i) => done.has(i.id)).length, 0)
  const progress = total ? count / total : 0
  const applyDirect = useChat((s) => s.applyDirect)
  // 正在確認刪除的項目
  const [removing, setRemoving] = useState<{ id: string; busy?: boolean; error?: string }>()
  const remove = async (group: string, id: string, label: string) => {
    setRemoving({ id, busy: true })
    try {
      await applyDirect(trip.id, [{ op: 'remove_checklist_item', ref: id, group }], `刪除清單項目：${label}`)
      setRemoving(undefined)
    } catch (e) {
      setRemoving({ id, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // 新版瀏覽器的 scrollTo 會回傳 Promise，不能直接當 effect 的回傳值（React 會把它當成清理函式呼叫）
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="pt-2">
      <Card className="flex items-center gap-4 bg-cream">
        <GrowingTree progress={progress} className="w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black">{encouragement[progress >= 1 ? 4 : Math.floor(progress * 4)]}</p>
          <p className="text-sm font-bold tabular-nums text-mute">
            出發前準備 {count} / {total}
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-card">
            <motion.div
              className={`h-full rounded-full ${gradient}`}
              animate={{ width: `${progress * 100}%` }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          </div>
          <p className="mt-2 text-[11px] text-mute">勾選紀錄只存在這支手機上；刪除項目兩個人都會看到。</p>
        </div>
      </Card>

      {trip.checklist.map((group) => (
        <div key={group.title}>
          <SectionTitle>{group.title}</SectionTitle>
          <Card className="divide-y-2 divide-cream p-0">
            {group.items.map((item) => {
              const on = done.has(item.id)
              const confirming = removing?.id === item.id
              return (
                <div key={item.id}>
                  <div className="flex items-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(trip.id, item.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left active:bg-cream/60"
                    >
                      <motion.span
                        animate={{ scale: on ? [1, 1.25, 1] : 1, rotate: on ? [0, -10, 0] : 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                          on ? `border-transparent ${gradient}` : 'border-butter bg-card'
                        }`}
                      >
                        {on && <Check className="size-4 text-ink" strokeWidth={3.2} />}
                      </motion.span>
                      <span className={`text-sm font-bold transition-colors ${on ? 'text-mute line-through' : ''}`}>{item.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoving(confirming ? undefined : { id: item.id })}
                      aria-label={`刪除「${item.label}」`}
                      className="mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-mute active:bg-cream"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {confirming && (
                    <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-peach/30 px-3 py-2 text-xs font-bold">
                      {removing.busy ? (
                        <span className="inline-flex items-center gap-1 text-mute">
                          <LoaderCircle className="size-3.5 animate-spin" />
                          刪除中…
                        </span>
                      ) : (
                        <>
                          <span className="flex-1">從清單刪掉「{item.label}」？</span>
                          <button
                            type="button"
                            onClick={() => void remove(group.title, item.id, item.label)}
                            className="rounded-full bg-peach-ink px-3 py-1 text-white"
                          >
                            刪除
                          </button>
                          <button type="button" onClick={() => setRemoving(undefined)} className="px-1 text-mute">
                            取消
                          </button>
                        </>
                      )}
                      {removing.error && <p className="basis-full text-peach-ink">{removing.error}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </Card>
        </div>
      ))}
    </div>
  )
}
