import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check, LoaderCircle, Pencil, Trash2 } from 'lucide-react'
import type { Trip } from '../types'
import { useChat } from '../lib/chatStore'
import { usePrefs } from '../lib/store'
import { Card, SectionTitle, gradient } from './ui'
import { GrowingTree } from './illustrations'

const encouragement = ['種下一顆種子吧', '發芽了！', '長出葉子了', '快變成一棵樹了', '準備完成，出發！']

export default function ChecklistView({ trip }: { trip: Trip }) {
  const applyDirect = useChat((s) => s.applyDirect)
  const passcode = useChat((s) => s.passcode)
  const legacy = usePrefs((s) => s.checked[trip.id])
  const clearLegacy = usePrefs((s) => s.clearChecked)
  // 已經按了、還在等伺服器的勾選（先顯示，失敗再退回）
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [toggleError, setToggleError] = useState('')
  // 勾選一個一個送，連點時才不會後送的先到、把狀態蓋回去
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const isDone = (item: { id: string; done?: boolean }) => pending[item.id] ?? !!item.done
  const total = trip.checklist.reduce((n, g) => n + g.items.length, 0)
  const count = trip.checklist.reduce((n, g) => n + g.items.filter(isDone).length, 0)
  const progress = total ? count / total : 0

  const toggle = (group: string, item: { id: string; label: string; done?: boolean }) => {
    if (!passcode) return setToggleError('勾選會同步給兩個人，要先在小樹那邊輸入通關密語')
    const next = !isDone(item)
    setToggleError('')
    setPending((p) => ({ ...p, [item.id]: next }))
    const settle = () =>
      setPending((p) => {
        if (p[item.id] !== next) return p
        const { [item.id]: _, ...rest } = p
        return rest
      })
    queue.current = queue.current
      .then(() => applyDirect(trip.id, [{ op: 'check_checklist_item', ref: item.id, group, done: next }], `${next ? '勾掉' : '取消勾選'}：${item.label}`))
      .then(settle, (e: unknown) => {
        settle()
        setToggleError(e instanceof Error ? e.message : String(e))
      })
  }

  // 以前勾選只存在這支手機上：第一次打開時把那些勾選搬進行程，之後兩個人看到同一份
  const migrating = useRef(false)
  useEffect(() => {
    if (!passcode || !legacy?.length || migrating.current) return
    const ids = legacy.filter((id) => trip.checklist.some((g) => g.items.some((i) => i.id === id && !i.done)))
    if (!ids.length) return clearLegacy(trip.id)
    migrating.current = true
    applyDirect(
      trip.id,
      ids.map((id) => ({ op: 'check_checklist_item', ref: id, done: true })),
      '同步這支手機原本的清單勾選',
    )
      .then(() => clearLegacy(trip.id))
      .catch(() => undefined)
      .finally(() => (migrating.current = false))
  }, [passcode, legacy, trip.checklist, trip.id, applyDirect, clearLegacy])
  // 正在編輯或確認刪除的項目（同一時間只有一項）
  const [action, setAction] = useState<{ id: string; mode: 'edit' | 'delete'; text?: string; busy?: boolean; error?: string }>()
  const run = async (group: string, id: string, label: string) => {
    if (!action) return
    const text = action.text?.trim()
    if (action.mode === 'edit' && (!text || text === label)) return setAction(undefined)
    setAction({ ...action, busy: true, error: undefined })
    try {
      if (action.mode === 'edit')
        await applyDirect(trip.id, [{ op: 'update_checklist_item', ref: id, group, label: text }], `修改清單項目：${text}`)
      else await applyDirect(trip.id, [{ op: 'remove_checklist_item', ref: id, group }], `刪除清單項目：${label}`)
      setAction(undefined)
    } catch (e) {
      setAction({ ...action, busy: false, error: e instanceof Error ? e.message : String(e) })
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
          <p className="mt-2 text-[11px] text-mute">勾選、編輯、刪除，兩個人看到的都是同一份。</p>
        </div>
      </Card>
      {toggleError && <p className="mt-3 rounded-2xl bg-peach/40 px-3 py-2 text-sm font-bold text-peach-ink">{toggleError}</p>}

      {trip.checklist.map((group) => (
        <div key={group.title}>
          <SectionTitle>{group.title}</SectionTitle>
          <Card className="divide-y-2 divide-cream p-0">
            {group.items.map((item) => {
              const on = isDone(item)
              const current = action?.id === item.id ? action : undefined
              const editing = current?.mode === 'edit'
              return (
                <div key={item.id}>
                  <div className="flex items-center">
                    {editing ? (
                      <form
                        className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void run(group.title, item.id, item.label)
                        }}
                      >
                        <input
                          autoFocus
                          value={current.text ?? ''}
                          onChange={(e) => setAction({ ...current, text: e.target.value })}
                          aria-label={`修改「${item.label}」`}
                          className="min-w-0 flex-1 rounded-2xl border-2 border-sky bg-card px-3 py-1.5 text-[16px] outline-none"
                        />
                        {current.busy ? (
                          <LoaderCircle className="size-4 animate-spin text-mute" />
                        ) : (
                          <>
                            <button type="submit" className="rounded-full bg-sky/40 px-3 py-1 text-xs font-bold text-sky-ink">
                              儲存
                            </button>
                            <button type="button" onClick={() => setAction(undefined)} className="px-1 text-xs font-bold text-mute">
                              取消
                            </button>
                          </>
                        )}
                      </form>
                    ) : (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(group.title, item)}
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
                    )}
                    {!editing && (
                      <div className="mr-2 flex shrink-0">
                        <button
                          type="button"
                          onClick={() => setAction({ id: item.id, mode: 'edit', text: item.label })}
                          aria-label={`編輯「${item.label}」`}
                          className="flex size-9 items-center justify-center rounded-full text-mute active:bg-cream"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAction(current?.mode === 'delete' ? undefined : { id: item.id, mode: 'delete' })}
                          aria-label={`刪除「${item.label}」`}
                          className="flex size-9 items-center justify-center rounded-full text-mute active:bg-cream"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {current?.mode === 'delete' && (
                    <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-peach/30 px-3 py-2 text-xs font-bold">
                      {current.busy ? (
                        <span className="inline-flex items-center gap-1 text-mute">
                          <LoaderCircle className="size-3.5 animate-spin" />
                          刪除中…
                        </span>
                      ) : (
                        <>
                          <span className="flex-1">從清單刪掉「{item.label}」？</span>
                          <button
                            type="button"
                            onClick={() => void run(group.title, item.id, item.label)}
                            className="rounded-full bg-peach-ink px-3 py-1 text-white"
                          >
                            刪除
                          </button>
                          <button type="button" onClick={() => setAction(undefined)} className="px-1 text-mute">
                            取消
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {current?.error && <p className="mx-4 mb-3 text-xs font-bold text-peach-ink">{current.error}</p>}
                </div>
              )
            })}
          </Card>
        </div>
      ))}
    </div>
  )
}
