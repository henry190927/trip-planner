import { useState } from 'react'
import { LoaderCircle, Redo2, Undo2 } from 'lucide-react'
import { useChat } from '../lib/chatStore'

/**
 * 復原最新一次修改。要再按一次確認，並寫出要復原的是哪一次，
 * 避免跟「重新整理」搞混（復原後再按一次復原就是重做）。
 */
export default function UndoButton({ tripId, summary, onDone }: { tripId: string; summary: string; onDone?: () => void }) {
  const undo = useChat((s) => s.undo)
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle')
  const [error, setError] = useState('')
  // 最新一次本身就是復原時，再復原一次等於重做
  const redo = /^復原：/.test(summary)
  const what = summary.replace(/^復原：/, '')

  const run = async () => {
    setStep('busy')
    setError('')
    try {
      await undo(tripId)
      setStep('done')
      onDone?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStep('idle')
    }
  }

  if (step === 'done') return <p className="mt-2 text-xs font-bold text-mute">{redo ? '已重做' : '已復原，行程回到這次修改之前'}</p>
  return (
    <div className="mt-2">
      {step === 'idle' && (
        <button
          type="button"
          onClick={() => setStep('confirm')}
          className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-bold active:scale-95"
        >
          {redo ? <Redo2 className="size-3.5" /> : <Undo2 className="size-3.5" />}
          {redo ? '重做（取消剛剛的復原）' : '復原這次修改'}
        </button>
      )}
      {step === 'confirm' && (
        <div className="rounded-2xl bg-peach/30 px-3 py-2 text-xs font-bold">
          <p>{redo ? `確定要重做「${what}」嗎？` : `確定要復原「${what}」嗎？行程會回到這次修改之前。`}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void run()} className="rounded-full bg-peach-ink px-3 py-1 text-white">
              {redo ? '重做' : '復原'}
            </button>
            <button type="button" onClick={() => setStep('idle')} className="px-1 text-mute">
              取消
            </button>
          </div>
        </div>
      )}
      {step === 'busy' && (
        <span className="inline-flex items-center gap-1 text-xs font-bold text-mute">
          <LoaderCircle className="size-3.5 animate-spin" />
          處理中…
        </span>
      )}
      {error && <p className="mt-1 text-xs font-bold text-peach-ink">{error}</p>}
    </div>
  )
}
