import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Fingerprint, LoaderCircle } from 'lucide-react'
import { inviteInfo } from '../lib/api'
import { isCancelled, useAuth } from '../lib/authStore'
import { TwoFriends } from './illustrations'
import { gradient } from './ui'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-8 pb-16 text-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex w-full flex-col items-center">
        <TwoFriends className="w-44" />
        <p className="mt-4 text-xs font-extrabold tracking-[0.25em] text-peach-ink">TRAVEL NOTES</p>
        <h1 className="mt-1 text-3xl font-black">旅行手帖</h1>
        {children}
      </motion.div>
    </div>
  )
}

function PasskeyButton({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`mt-8 inline-flex w-full max-w-72 items-center justify-center gap-2 rounded-full py-3.5 font-black ${gradient} active:scale-[0.98] disabled:opacity-60`}
    >
      {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Fingerprint className="size-5" />}
      {children}
    </button>
  )
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function LoginView() {
  const login = useAuth((s) => s.login)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await login()
    } catch (e) {
      if (!isCancelled(e)) setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell>
      <p className="mt-2 text-sm text-mute">我們兩個人的旅行</p>
      <PasskeyButton busy={busy} onClick={() => void run()}>
        用 Face ID／指紋登入
      </PasskeyButton>
      {error && <p className="mt-3 max-w-72 rounded-2xl bg-peach/40 px-3 py-2 text-sm font-bold text-peach-ink">{error}</p>}
      <p className="mt-8 max-w-72 text-xs leading-relaxed text-mute">
        第一次在這支手機使用？請已經登入的旅伴到首頁右上角的「帳號」，產生邀請連結傳給你。
      </p>
    </Shell>
  )
}

export function JoinView({ code }: { code: string }) {
  const join = useAuth((s) => s.join)
  const [info, setInfo] = useState<{ name?: string; newDevice: boolean }>()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    inviteInfo(code).then(
      (i) => {
        setInfo(i)
        setName(i.name ?? '')
      },
      (e: unknown) => setError(errorMessage(e)),
    )
  }, [code])

  const needsName = info && !info.newDevice
  const run = async () => {
    if (needsName && !name.trim()) return setError('請輸入名字')
    setBusy(true)
    setError('')
    try {
      await join(code, needsName ? name.trim() : undefined)
      // 加入完成：回首頁，邀請碼不要留在網址上
      window.location.replace('#/')
    } catch (e) {
      if (!isCancelled(e)) setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      {info ? (
        <>
          <p className="mt-4 text-lg font-black">{info.newDevice ? `${info.name}，把這台裝置加進來` : '歡迎加入'}</p>
          {needsName && (
            <label className="mt-4 block w-full max-w-72 text-left">
              <span className="text-xs font-extrabold text-mute">你的名字</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoComplete="nickname"
                placeholder="旅伴看到的名字"
                className="mt-1 w-full rounded-2xl border-2 border-butter bg-card px-4 py-2.5 text-center text-[16px] font-bold outline-none focus:border-sky"
              />
              <span className="mt-1 block text-[11px] text-mute">修改紀錄會顯示這個名字，之後可以在「帳號」裡改。</span>
            </label>
          )}
          <p className="mt-4 max-w-72 text-sm leading-relaxed text-mute">
            按下面的按鈕，用 Face ID 或指紋建立 passkey。之後打開旅行手帖，用同樣的方式就能登入，不用記密碼。
          </p>
          <PasskeyButton busy={busy || (!!needsName && !name.trim())} onClick={() => void run()}>
            建立 passkey
          </PasskeyButton>
        </>
      ) : (
        !error && <LoaderCircle className="mt-8 size-6 animate-spin text-mute" />
      )}
      {error && <p className="mt-6 max-w-72 rounded-2xl bg-peach/40 px-3 py-2 text-sm font-bold text-peach-ink">{error}</p>}
      <a href="#/" className="mt-8 text-xs font-bold text-mute underline">
        已經有帳號了，直接登入
      </a>
    </Shell>
  )
}

export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LoaderCircle className="size-6 animate-spin text-mute" aria-label="載入中" />
    </div>
  )
}
