import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { LoaderCircle, X } from 'lucide-react'
import type { Spot, SpotCategory, Trip } from '../types'
import { spotCategories } from '../schema'
import { useChat } from '../lib/chatStore'
import { mapLabel } from '../lib/maps'
import { spotOps, toForm, type SpotForm as Form } from '../lib/spotForm'
import { gradient } from './ui'

export const categoryLabels: Record<SpotCategory, string> = {
  food: '吃',
  cafe: '咖啡・飲料',
  shopping: '逛',
  sight: '景點',
  other: '其他',
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  // 說明放在 label 外面：欄位名稱只念名稱本身，不把整段說明當成名字
  return (
    <div>
      <label className="block">
        <span className="text-xs font-extrabold text-mute">{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1 text-[11px] text-mute">{hint}</p>}
    </div>
  )
}

const inputClass = 'mt-1 w-full rounded-2xl border-2 border-butter bg-card px-3 py-2 text-[16px] outline-none focus:border-sky'

export default function SpotEditor({ trip, spot, open, onClose }: { trip: Trip; spot?: Spot; open: boolean; onClose: () => void }) {
  const applyDirect = useChat((s) => s.applyDirect)
  const [form, setForm] = useState<Form>(() => toForm(spot))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const areas = [...new Set((trip.spots ?? []).map((s) => s.area).filter(Boolean))] as string[]
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  const save = async () => {
    if (!form.name.trim()) return setError('要有名稱')
    if (form.mapLink.trim() && !/^https?:\/\//.test(form.mapLink.trim())) return setError('地圖連結要是 http 開頭的網址')
    const ops = spotOps(trip, form, spot)
    if (!ops.length) return onClose()
    setBusy(true)
    setError('')
    try {
      await applyDirect(trip.id, ops, spot ? `編輯地點：${form.name.trim()}` : `新增地點：${form.name.trim()}`)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // 地點分頁在有位移動畫的容器裡，fixed 會以那個容器為準，所以畫到 body 底下
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.section
            role="dialog"
            aria-label={spot ? '編輯地點' : '新增地點'}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', bounce: 0.12, duration: 0.45 }}
            className="pb-safe fixed bottom-0 left-1/2 z-50 flex max-h-[88dvh] w-full max-w-(--frame) -translate-x-1/2 flex-col rounded-t-[2rem] bg-paper"
          >
            <header className="flex items-center gap-2 border-b-2 border-cream px-4 pb-2 pt-3">
              <p className="flex-1 font-black">{spot ? '編輯地點' : '新增地點'}</p>
              <button type="button" onClick={onClose} aria-label="關閉" className="flex size-9 items-center justify-center rounded-full bg-cream">
                <X className="size-5" />
              </button>
            </header>
            <form
              className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <Field label="名稱">
                <input value={form.name} onChange={set('name')} className={inputClass} placeholder="例如：MISS 豬腳 弘大店" />
              </Field>
              <Field label="當地名稱" hint="用韓文、日文店名，地圖比較搜得到">
                <input value={form.local} onChange={set('local')} className={inputClass} />
              </Field>
              <div>
                <span className="text-xs font-extrabold text-mute">分類</span>
                <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="分類">
                  {spotCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={form.category === c}
                      onClick={() => setForm({ ...form, category: c })}
                      className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${form.category === c ? 'bg-ink text-paper' : 'bg-card text-mute'}`}
                    >
                      {categoryLabels[c]}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="地區" hint={areas.length ? `已經有：${areas.join('、')}` : undefined}>
                <input value={form.area} onChange={set('area')} className={inputClass} list="spot-areas" />
                <datalist id="spot-areas">
                  {areas.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </Field>
              <Field label="營業時間" hint="例如：12:30–24:00（最後點餐 23:00）。改了會記今天確認">
                <input value={form.hours} onChange={set('hours')} className={inputClass} />
              </Field>
              <Field label="公休">
                <input value={form.closed} onChange={set('closed')} className={inputClass} placeholder="例如：每週二" />
              </Field>
              <Field label="怎麼去">
                <input value={form.access} onChange={set('access')} className={inputClass} placeholder="例如：弘大入口站 9 號出口走路 3 分" />
              </Field>
              <Field
                label="地圖連結"
                hint={
                  form.mapLink.trim()
                    ? '按「地圖」會直接打開這個地點'
                    : `沒填的話，按鈕只能用「${form.mapQuery.trim() || form.local.trim() || form.name.trim() || '名稱'}」搜尋，可能跳到別間分店。要指定確切的那間：在 ${mapLabel[trip.mapProvider]} 打開店家頁 → 分享 → 複製連結，貼在這裡`
                }
              >
                <input value={form.mapLink} onChange={set('mapLink')} className={inputClass} inputMode="url" placeholder="https://naver.me/…" />
              </Field>
              <Field label="地圖搜尋用的字" hint="沒有地圖連結時用；寫完整店名（含分店名）比較準">
                <input value={form.mapQuery} onChange={set('mapQuery')} className={inputClass} placeholder={form.local || form.name} />
              </Field>
              <Field label="標籤" hint="用頓號或逗號分開">
                <input value={form.tags} onChange={set('tags')} className={inputClass} placeholder="宵夜、可外帶" />
              </Field>
              <Field label="說明">
                <textarea value={form.note} onChange={set('note')} rows={2} className={inputClass} />
              </Field>
              <Field label="待確認">
                <input value={form.verify} onChange={set('verify')} className={inputClass} />
              </Field>
              {error && <p className="rounded-2xl bg-peach/40 px-3 py-2 text-sm font-bold text-peach-ink">{error}</p>}
              <button type="submit" disabled={busy} className={`w-full rounded-full py-3 font-black ${gradient} disabled:opacity-50`}>
                {busy ? <LoaderCircle className="mx-auto size-5 animate-spin" /> : '儲存'}
              </button>
            </form>
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
