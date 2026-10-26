import { useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import type { Item, Trip } from '../types'
import { useChat } from '../lib/chatStore'

/** 小任務的打勾框：直接寫後端，不經過小樹 */
export default function TaskCheck({ item, date, trip }: { item: Item; date: string; trip: Trip }) {
  const applyDirect = useChat((s) => s.applyDirect)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const done = !!item.todo?.done

  const toggle = async () => {
    setBusy(true)
    setError('')
    try {
      await applyDirect(trip.id, [{ op: 'complete_task', date, title: item.title, time: item.time, done: !done }], `${done ? '改回還沒完成' : '完成'}小任務`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={done}
        aria-label={done ? `「${item.title}」改回還沒完成` : `「${item.title}」標成完成`}
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          done ? 'border-transparent bg-[linear-gradient(135deg,var(--sky),var(--peach))]' : 'border-mute/50 bg-card'
        }`}
      >
        {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : done && <Check className="size-3.5" strokeWidth={3.5} />}
      </button>
      {error && <p className="basis-full rounded-xl bg-peach/40 px-2.5 py-1.5 text-xs font-bold text-peach-ink">{error}</p>}
    </>
  )
}
