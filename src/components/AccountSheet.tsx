import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Copy, LoaderCircle, LogOut, Pencil, Share, Smartphone, Trash2, UserPlus, X } from 'lucide-react'
import { createInvite, removeCredential } from '../lib/api'
import { useAuth } from '../lib/authStore'
import { relativeTime } from '../lib/dates'
import { inviteUrl } from '../lib/router'
import { Card, SectionTitle } from './ui'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

function InviteLink({ url, onDone }: { url: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // 複製不了就讓使用者自己長按選取
    }
  }
  const canShare = typeof navigator.share === 'function'
  return (
    <div className="mt-3 rounded-2xl bg-cream p-3">
      <p className="break-all font-mono text-[11px] leading-relaxed text-mute">{url}</p>
      <p className="mt-1 text-[11px] font-bold text-peach-ink">24 小時內有效，用一次就失效。只傳給要加入的人。</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-bold">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? '已複製' : '複製連結'}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => void navigator.share({ title: '旅行手帖邀請', url }).catch(() => undefined)}
            className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-bold"
          >
            <Share className="size-3.5" />
            分享
          </button>
        )}
        <button type="button" onClick={onDone} className="ml-auto px-2 text-xs font-bold text-mute">
          完成
        </button>
      </div>
    </div>
  )
}

export default function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const reload = useAuth((s) => s.reload)
  const rename = useAuth((s) => s.rename)
  const [invite, setInvite] = useState<{ url: string; kind: 'device' | 'person' }>()
  const [editingName, setEditingName] = useState<string>()
  const [confirmRemove, setConfirmRemove] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState('')

  const run = async (key: string, f: () => Promise<void>) => {
    setBusy(key)
    setError('')
    try {
      await f()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(undefined)
    }
  }

  const makeInvite = (kind: 'device' | 'person') =>
    run(kind, async () => {
      const { code } = await createInvite(kind)
      setInvite({ url: inviteUrl(code), kind })
    })

  return createPortal(
    <AnimatePresence>
      {open && user && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.section
            role="dialog"
            aria-label="帳號"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', bounce: 0.12, duration: 0.45 }}
            className="pb-safe fixed bottom-0 left-1/2 z-50 flex max-h-[88dvh] w-full max-w-(--frame) -translate-x-1/2 flex-col rounded-t-[2rem] bg-paper"
          >
            <header className="flex items-center gap-2 border-b-2 border-cream px-4 pb-2 pt-3">
              <div className="min-w-0 flex-1">
                <p className="font-black leading-tight">帳號</p>
                <p className="text-[11px] font-bold text-mute">目前登入：{user.name}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="關閉" className="flex size-9 items-center justify-center rounded-full bg-cream">
                <X className="size-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <SectionTitle>名字</SectionTitle>
              {editingName === undefined ? (
                <Card className="flex items-center gap-3 py-3">
                  <p className="min-w-0 flex-1 font-black">{user.name}</p>
                  <button
                    type="button"
                    onClick={() => setEditingName(user.name)}
                    aria-label="改名字"
                    className="flex size-9 items-center justify-center rounded-full text-mute active:bg-cream"
                  >
                    <Pencil className="size-4" />
                  </button>
                </Card>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run('rename', async () => {
                      await rename(editingName)
                      setEditingName(undefined)
                    })
                  }}
                  className="soft-shadow flex items-center gap-2 rounded-3xl bg-card px-3 py-2"
                >
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    maxLength={20}
                    aria-label="名字"
                    className="min-w-0 flex-1 rounded-xl border-2 border-butter bg-card px-3 py-1.5 text-[16px] outline-none focus:border-sky"
                  />
                  <button type="submit" disabled={!editingName.trim() || !!busy} className="rounded-full bg-sky/40 px-3 py-1.5 text-xs font-bold text-sky-ink disabled:opacity-50">
                    {busy === 'rename' ? '儲存中…' : '儲存'}
                  </button>
                  <button type="button" onClick={() => setEditingName(undefined)} className="px-1 text-xs font-bold text-mute">
                    取消
                  </button>
                </form>
              )}

              <SectionTitle>我的裝置</SectionTitle>
              <Card className="divide-y-2 divide-cream p-0">
                {user.credentials.map((c) => (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Smartphone className="size-5 shrink-0 text-sky-ink" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold">{c.label}</p>
                        <p className="text-[11px] text-mute">
                          {c.lastUsedAt ? `上次使用：${relativeTime(c.lastUsedAt)}` : `加入：${relativeTime(c.createdAt)}`}
                        </p>
                      </div>
                      {user.credentials.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(confirmRemove === c.id ? undefined : c.id)}
                          aria-label={`移除「${c.label}」`}
                          className="flex size-9 items-center justify-center rounded-full text-mute active:bg-cream"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    {confirmRemove === c.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-peach/30 px-3 py-2 text-xs font-bold">
                        <span className="flex-1">移除後，這台裝置會立刻被登出，要再用邀請連結才能加回來。</span>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() =>
                            void run(`remove-${c.id}`, async () => {
                              await removeCredential(c.id)
                              setConfirmRemove(undefined)
                              await reload()
                            })
                          }
                          className="rounded-full bg-peach-ink px-3 py-1 text-white"
                        >
                          {busy === `remove-${c.id}` ? '移除中…' : '移除'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </Card>
              <p className="mt-2 px-1 text-[11px] leading-relaxed text-mute">
                手機遺失時，從另一台裝置把它移除，它就會被登出。Apple 裝置之間的 passkey 會透過 iCloud 鑰匙圈同步。
              </p>

              <SectionTitle>邀請</SectionTitle>
              {invite ? (
                <InviteLink url={invite.url} onDone={() => setInvite(undefined)} />
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void makeInvite('device')}
                    className="soft-shadow flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left text-sm font-bold active:scale-[0.99]"
                  >
                    {busy === 'device' ? <LoaderCircle className="size-5 animate-spin" /> : <Smartphone className="size-5 text-sky-ink" />}
                    加一台我自己的新裝置
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void makeInvite('person')}
                    className="soft-shadow flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left text-sm font-bold active:scale-[0.99]"
                  >
                    {busy === 'person' ? <LoaderCircle className="size-5 animate-spin" /> : <UserPlus className="size-5 text-sky-ink" />}
                    邀請新旅伴
                  </button>
                </div>
              )}

              {error && <p className="mt-3 rounded-2xl bg-peach/40 px-3 py-2 text-sm font-bold text-peach-ink">{error}</p>}

              <button
                type="button"
                onClick={() => void logout().then(onClose)}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cream py-3 text-sm font-black text-mute"
              >
                <LogOut className="size-4" />
                登出這台裝置
              </button>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
