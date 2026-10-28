import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Check, Copy, Globe, ImagePlus, LoaderCircle, Minus, Pencil, Plus, Square, Trash2, X } from 'lucide-react'
import type { Trip } from '../types'
import { API_BASE } from '../lib/api'
import { useChat, type Message, type ProposalState } from '../lib/chatStore'
import { Sprout, Sparkle } from './illustrations'
import { conversationText, copyText, messageText } from '../lib/chatText'
import { MAX_IMAGES, prepareImage, type PreparedImage } from '../lib/images'
import { quickActions } from '../lib/quickActions'
import { usePrefs } from '../lib/store'
import { useNow } from '../lib/time'
import RichText from './RichText'
import UndoButton from './UndoButton'
import { useTrips } from '../lib/tripStore'
import { gradient } from './ui'

const suggestions = [
  '11/7 早上幫我在延南洞加一間咖啡廳',
  'MISS 豬腳營業到幾點？',
  '11/6 取票前，KBS Arena 附近有什麼可以快速吃的？',
  '首爾 11 月初的天氣要怎麼穿？',
  '11/7 午餐晚了 30 分，幫我調整後面的行程',
]

function MiniSprout({ className = 'size-9' }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-cream ${className}`}>
      <Sprout className="w-[85%]" />
    </span>
  )
}

function Typing() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="小樹正在輸入">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-peach-ink/50"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}

const changeIcon = {
  add: { Icon: Plus, cls: 'bg-sky/50 text-sky-ink' },
  update: { Icon: Pencil, cls: 'bg-butter text-[#a8661c]' },
  remove: { Icon: Minus, cls: 'bg-peach/60 text-peach-ink' },
}

function ProposalCard({ p, tripId, onApply, onDismiss }: { p: ProposalState; tripId: string; onApply: () => void; onDismiss: () => void }) {
  // 只有這次修改還是最新的一版時，復原才會復原到它
  const latest = useTrips((s) => s.byId[tripId]?.version)
  const [undone, setUndone] = useState(false)
  const done = p.state === 'applied' || p.state === 'dismissed'
  return (
    <div className={`mt-2 rounded-2xl border-2 p-3 ${p.state === 'applied' ? 'border-sky bg-sky/15' : 'border-butter bg-card'}`}>
      <p className="text-xs font-extrabold text-peach-ink">建議修改</p>
      <p className="mt-0.5 font-black leading-snug">{p.proposal.summary}</p>
      <ul className="mt-2 space-y-1.5">
        {p.proposal.changes.map((c, i) => {
          const { Icon, cls } = changeIcon[c.kind]
          return (
            <li key={i} className="flex gap-2 text-sm leading-snug">
              <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${cls}`}>
                <Icon className="size-3" strokeWidth={3} />
              </span>
              <span className={p.state === 'dismissed' ? 'text-mute line-through' : ''}>{c.text}</span>
            </li>
          )
        })}
      </ul>
      {p.error && <p className="mt-2 text-xs font-bold text-peach-ink">{p.error}</p>}
      <div className="mt-3 flex gap-2">
        {p.state === 'applied' && (
          <div>
            <p className="inline-flex items-center gap-1 text-sm font-black text-sky-ink">
              <Check className="size-4" strokeWidth={3} />
              已套用到行程
            </p>
            {undone ? (
              <p className="mt-2 text-xs font-bold text-mute">已復原，行程回到這次修改之前</p>
            ) : (
              p.version !== undefined &&
              p.version === latest && <UndoButton tripId={tripId} summary={p.proposal.summary} onDone={() => setUndone(true)} />
            )}
          </div>
        )}
        {p.state === 'dismissed' && <p className="text-sm font-bold text-mute">沒有套用</p>}
        {!done && (
          <>
            <button
              type="button"
              onClick={onApply}
              disabled={p.state === 'applying'}
              className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-black ${gradient} disabled:opacity-60`}
            >
              {p.state === 'applying' ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={3} />}
              {p.state === 'failed' ? '再試一次' : '套用'}
            </button>
            <button type="button" onClick={onDismiss} className="rounded-full bg-cream px-4 py-1.5 text-sm font-bold text-mute">
              不用了
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CopyButton({ text, label, className = '', iconOnly = false }: { text: () => string; label: string; className?: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false)
  const onClick = async () => {
    if (await copyText(text())) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      aria-label={copied ? '已複製' : label}
      className={`inline-flex items-center gap-1 rounded-full text-[11px] font-bold text-mute active:bg-cream ${className}`}
    >
      {copied ? <Check className="size-3.5 text-sky-ink" /> : <Copy className="size-3.5" />}
      {copied && !iconOnly && <span className="text-sky-ink">已複製</span>}
    </button>
  )
}

function Bubble({ m, tripId }: { m: Message; tripId: string }) {
  const apply = useChat((s) => s.apply)
  const dismiss = useChat((s) => s.dismiss)
  if (m.role === 'user')
    return (
      <div className="flex items-end justify-end gap-1">
        <CopyButton text={() => messageText(m)} label="複製這則訊息" className="mb-1 p-1.5" />
        <div className="flex max-w-[85%] flex-col items-end gap-1.5">
          {m.images && m.images.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {m.images.map((src, i) => (
                <img key={i} src={src} alt={`附圖 ${i + 1}`} className="size-20 rounded-2xl object-cover" />
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap rounded-3xl rounded-br-lg bg-peach px-4 py-2.5 text-sm font-bold leading-relaxed">{m.text}</p>
        </div>
      </div>
    )
  return (
    <div className="flex gap-2">
      <MiniSprout className="mt-1 size-8" />
      <div className="min-w-0 max-w-[88%] flex-1">
        {m.status?.map((s, i) => (
          <p key={i} className="mb-1 inline-flex items-center gap-1 text-xs font-bold text-mute">
            {s.startsWith('搜尋') ? <Globe className="size-3.5" /> : <LoaderCircle className="size-3.5" />}
            {s}
          </p>
        ))}
        {(m.text || m.streaming) && (
          <div className="soft-shadow rounded-3xl rounded-tl-lg bg-card px-4 py-2.5 text-sm leading-relaxed">
            {m.text ? <RichText text={m.text} /> : <Typing />}
          </div>
        )}
        {m.sources && m.sources.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {m.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="max-w-[12rem] truncate rounded-full bg-sky/30 px-2.5 py-1 text-[11px] font-bold text-sky-ink"
              >
                {s.title}
              </a>
            ))}
          </div>
        )}
        {m.proposals?.map((p) => (
          <ProposalCard
            tripId={tripId}
            key={p.proposal.id}
            p={p}
            onApply={() => void apply(tripId, m.id, p.proposal.id)}
            onDismiss={() => dismiss(tripId, m.id, p.proposal.id)}
          />
        ))}
        {m.error && <p className="mt-2 rounded-2xl bg-peach/40 px-3 py-2 text-xs font-bold text-peach-ink">{m.error}</p>}
        {!m.streaming && m.text && <CopyButton text={() => messageText(m)} label="複製回覆" className="mt-1 px-1.5 py-1" />}
      </div>
    </div>
  )
}

function PasscodeGate() {
  const login = useChat((s) => s.login)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(value.trim())
    } catch {
      setError('通關密語不對，或是連不上網路。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <Sprout className="w-28" />
      <p className="text-lg font-black">先輸入通關密語</p>
      <p className="text-sm text-mute">每支手機只要輸入一次。</p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="current-password"
        type="password"
        placeholder="通關密語"
        className="w-full max-w-60 rounded-2xl border-2 border-butter bg-card px-4 py-2.5 text-center font-bold outline-none focus:border-sky"
      />
      {error && <p className="text-xs font-bold text-peach-ink">{error}</p>}
      <button type="submit" disabled={!value.trim() || busy} className={`rounded-full px-6 py-2.5 font-black ${gradient} disabled:opacity-50`}>
        {busy ? '確認中…' : '開始聊天'}
      </button>
    </form>
  )
}

export default function ChatSheet({ trip }: { trip: Trip }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  // 其他頁面請聊天框打開、先填好一句話
  const draft = useChat((s) => s.draft)
  const [handledDraft, setHandledDraft] = useState(draft?.n)
  if (draft && draft.n !== handledDraft && draft.tripId === trip.id) {
    setHandledDraft(draft.n)
    setOpen(true)
    setInput(draft.text)
  }
  const passcode = useChat((s) => s.passcode)
  const messages = useChat((s) => s.threads[trip.id]) ?? []
  const busy = useChat((s) => s.busy)
  const send = useChat((s) => s.send)
  const stop = useChat((s) => s.stop)
  const clear = useChat((s) => s.clear)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const now = useNow(trip.timezone)
  const viewer = usePrefs((s) => s.viewer[trip.id])
  const actions = quickActions(trip, now, viewer)
  const [attachments, setAttachments] = useState<PreparedImage[]>([])
  const [preparing, setPreparing] = useState(false)
  const [attachError, setAttachError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // 有新內容（訊息、串流文字、搜尋狀態、修改建議）時捲到最底
  const last = messages.at(-1)
  const contentKey = `${messages.length}:${last?.text.length}:${last?.status?.length}:${last?.proposals?.length}`
  useEffect(() => {
    if (!open || !contentKey) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [open, contentKey])

  // 輸入框跟著內容長高：打字、快捷按鈕或其他頁面填進來的文字都一樣
  useEffect(() => {
    const el = inputRef.current
    if (!el || !open) return
    el.style.height = 'auto'
    // 清空時回到原本的高度
    el.style.height = input ? `${Math.min(el.scrollHeight, 120)}px` : ''
  }, [input, open])

  // 開著聊天框時不讓背後的頁面跟著捲
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!API_BASE) return null

  const attach = async (files: FileList | null) => {
    if (!files?.length) return
    setAttachError('')
    const room = MAX_IMAGES - attachments.length
    if (files.length > room) setAttachError(`一次最多附 ${MAX_IMAGES} 張圖`)
    setPreparing(true)
    try {
      const ready = await Promise.all([...files].slice(0, room).map(prepareImage))
      setAttachments((cur) => [...cur, ...ready].slice(0, MAX_IMAGES))
    } catch (e) {
      setAttachError(e instanceof Error ? e.message : '圖片讀不出來')
    } finally {
      setPreparing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = (text = input) => {
    const t = text.trim() || (attachments.length ? '請看圖片' : '')
    if (!t || busy || preparing) return
    setInput('')
    setAttachments([])
    setAttachError('')
    void send(trip.id, t, attachments)
  }

  return (
    <>
      <motion.button
        type="button"
        aria-label="打開旅行小幫手"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.9 }}
        className={`soft-shadow fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50%-var(--frame)/2+1rem))] z-30 flex size-14 items-center justify-center rounded-full ${gradient}`}
      >
        <Sprout className="w-12" />
        <svg viewBox="0 0 24 24" className="absolute -right-0.5 -top-0.5 size-5">
          <Sparkle x={12} y={12} r={9} fill="#FFE8C4" />
        </svg>
      </motion.button>

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
              aria-label="旅行小幫手"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', bounce: 0.12, duration: 0.45 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              dragListener={false}
              className="pb-safe fixed bottom-0 left-1/2 z-50 flex h-[88dvh] w-full max-w-(--frame) -translate-x-1/2 flex-col rounded-t-[2rem] bg-paper"
            >
              <header className="flex items-center gap-2 border-b-2 border-cream px-4 pb-2 pt-3">
                <MiniSprout />
                <div className="min-w-0 flex-1">
                  <p className="font-black leading-tight">小樹</p>
                  <p className="text-[11px] font-bold text-mute">會上網查資料・改行程前先問你</p>
                </div>
                {messages.length > 0 && !busy && (
                  <CopyButton text={() => conversationText(messages)} label="複製整段對話" className="size-9 justify-center bg-cream text-ink" iconOnly />
                )}
                {messages.length > 0 && !busy && (
                  <button type="button" onClick={() => clear(trip.id)} aria-label="清除對話" className="flex size-9 items-center justify-center rounded-full bg-cream">
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="關閉" className="flex size-9 items-center justify-center rounded-full bg-cream">
                  <X className="size-5" />
                </button>
              </header>


              {!passcode ? (
                <PasscodeGate />
              ) : (
                <>
                  <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center pt-4 text-center">
                        <Sprout className="w-28" />
                        <p className="mt-2 text-lg font-black">嗨！我是小樹</p>
                        <p className="mt-1 text-sm text-mute">想加什麼行程、查什麼資料，都可以問我。</p>
                        <div className="mt-5 flex flex-col gap-2">
                          {suggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => submit(s)}
                              className="soft-shadow rounded-2xl bg-card px-4 py-2.5 text-left text-sm font-bold active:scale-[0.98]"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((m) => (
                      <Bubble key={m.id} m={m} tripId={trip.id} />
                    ))}
                  </div>

                  {actions.length > 0 && !busy && (
                    <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t-2 border-cream px-3 pt-2" aria-label="旅行中的快捷按鈕">
                      {actions.map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          onClick={() => {
                            setInput(a.text)
                            inputRef.current?.focus()
                          }}
                          className="shrink-0 rounded-full bg-cream px-3 py-1.5 text-xs font-extrabold active:scale-95"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {(attachments.length > 0 || preparing || attachError) && (
                    <div className="flex items-center gap-2 border-t-2 border-cream px-3 pt-2">
                      {attachments.map((a, i) => (
                        <div key={i} className="relative">
                          <img src={a.thumb} alt={`要附的圖 ${i + 1}`} className="size-14 rounded-xl object-cover" />
                          <button
                            type="button"
                            onClick={() => setAttachments((cur) => cur.filter((_, j) => j !== i))}
                            aria-label={`移除第 ${i + 1} 張圖`}
                            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-paper"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                      {preparing && <LoaderCircle className="size-5 animate-spin text-mute" />}
                      {attachError && <p className="text-xs font-bold text-peach-ink">{attachError}</p>}
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      submit()
                    }}
                    className={`flex items-end gap-2 px-3 pb-2 pt-2 ${attachments.length || preparing || attachError ? '' : 'border-t-2 border-cream'}`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      aria-label="選擇圖片"
                      onChange={(e) => void attach(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={busy || attachments.length >= MAX_IMAGES}
                      aria-label="附上圖片"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cream text-ink disabled:opacity-40"
                    >
                      <ImagePlus className="size-5" />
                    </button>
                    <textarea
                      ref={inputRef}
                      value={input}
                      rows={1}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        // 中文輸入法選字時的 Enter 不送出
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                          submit()
                        }
                      }}
                      placeholder="問小樹，或請小樹改行程…"
                      aria-label="訊息"
                      className="max-h-30 min-h-11 flex-1 resize-none rounded-3xl border-2 border-butter bg-card px-4 py-2.5 text-[16px] leading-snug outline-none focus:border-sky"
                    />
                    {busy ? (
                      <button type="button" onClick={stop} aria-label="停止" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cream">
                        <Square className="size-4 fill-current" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        aria-label="送出"
                        disabled={(!input.trim() && !attachments.length) || preparing}
                        className={`flex size-11 shrink-0 items-center justify-center rounded-full ${gradient} disabled:opacity-40`}
                      >
                        <ArrowUp className="size-5" strokeWidth={3} />
                      </button>
                    )}
                  </form>
                </>
              )}
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
