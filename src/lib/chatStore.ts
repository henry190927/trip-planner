import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, usePrefs } from './store'
import { ApiError, applyManual, applyProposal, chat, checkPasscode, undoLast, type Proposal, type Source } from './api'
import { useTrips } from './tripStore'
import type { PreparedImage } from './images'

export interface ProposalState {
  proposal: Proposal
  state: 'pending' | 'applying' | 'applied' | 'dismissed' | 'failed'
  version?: number
  error?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  status?: string[]
  sources?: Source[]
  proposals?: ProposalState[]
  error?: string
  streaming?: boolean
  /** 使用者附的圖（只存縮圖，原圖只在送出那一次上傳） */
  images?: string[]
}

interface ChatState {
  passcode?: string
  /** tripId → 對話 */
  threads: Record<string, Message[]>
  busy: boolean
  /** 其他頁面請聊天框打開並先填好一句話（例如地點卡片的「排進行程」）；n 每次加一 */
  draft?: { tripId: string; text: string; n: number }
  ask: (tripId: string, text: string) => void
  /** 在畫面上直接改（不經過小樹），例如啟用備案；需要通關密語 */
  applyDirect: (tripId: string, ops: unknown[], summary: string) => Promise<void>
  login: (passcode: string) => Promise<void>
  send: (tripId: string, text: string, images?: PreparedImage[]) => Promise<void>
  stop: () => void
  apply: (tripId: string, messageId: string, proposalId: string) => Promise<void>
  dismiss: (tripId: string, messageId: string, proposalId: string) => void
  undo: (tripId: string) => Promise<string>
  clear: (tripId: string) => void
}

const uid = () => Math.random().toString(36).slice(2, 10)
let controller: AbortController | undefined

const errorText = (e: unknown) =>
  e instanceof ApiError
    ? e.status === 401
      ? '通關密語不對，請重新輸入。'
      : e.status === 0
        ? e.message
        : `${e.message}${e.details?.length ? `：${e.details.join('；')}` : ''}`
    : e instanceof TypeError
      ? '連不上小幫手，請確認網路。'
      : String(e)

export const useChat = create<ChatState>()(
  persist(
    (set, get) => {
      const patch = (tripId: string, id: string, f: (m: Message) => Message) =>
        set((s) => ({ threads: { ...s.threads, [tripId]: (s.threads[tripId] ?? []).map((m) => (m.id === id ? f(m) : m)) } }))
      const patchProposal = (tripId: string, id: string, pid: string, f: (p: ProposalState) => ProposalState) =>
        patch(tripId, id, (m) => ({ ...m, proposals: m.proposals?.map((p) => (p.proposal.id === pid ? f(p) : p)) }))

      return {
        threads: {},
        busy: false,

        login: async (passcode) => {
          await checkPasscode(passcode)
          set({ passcode })
        },

        send: async (tripId, text, images = []) => {
          const { passcode } = get()
          if (!passcode || get().busy) return
          const history = (get().threads[tripId] ?? []).filter((m) => m.text.trim() && !m.error)
          const user: Message = { id: uid(), role: 'user', text, ...(images.length && { images: images.map((i) => i.thumb) }) }
          const reply: Message = { id: uid(), role: 'assistant', text: '', streaming: true }
          set((s) => ({ busy: true, threads: { ...s.threads, [tripId]: [...(s.threads[tripId] ?? []), user, reply] } }))

          controller = new AbortController()
          try {
            // 之前附過的圖不重傳，只告訴模型那裡有圖
            const messages = [
              ...history.map((m) => ({ role: m.role, text: m.images?.length ? `${m.text}\n（當時附了 ${m.images.length} 張圖）` : m.text })),
              { role: user.role, text, images: images.map(({ mimeType, data }) => ({ mimeType, data })) },
            ]
            let finished = false
            for await (const e of chat(passcode, tripId, messages, controller.signal, usePrefs.getState().viewer[tripId])) {
              if (e.type === 'done') finished = true
              patch(tripId, reply.id, (m) => {
                switch (e.type) {
                  case 'text':
                    return { ...m, text: m.text + e.delta }
                  case 'status':
                    return { ...m, status: [...(m.status ?? []), e.text] }
                  case 'sources':
                    return { ...m, sources: [...(m.sources ?? []), ...e.sources.filter((s) => !m.sources?.some((x) => x.url === s.url))] }
                  case 'proposal':
                    return { ...m, proposals: [...(m.proposals ?? []), { proposal: e.proposal, state: 'pending' }] }
                  case 'error':
                    return { ...m, error: e.text }
                  default:
                    return m
                }
              })
            }
            // 沒收到結束訊號就斷了（手機切到背景、網路不穩）：明講，不要讓回覆看起來像說完了
            if (!finished)
              patch(tripId, reply.id, (m) => ({ ...m, error: m.error ?? '連線中斷了，回覆可能不完整，可以再問一次。' }))
          } catch (e) {
            if (!(e instanceof DOMException && e.name === 'AbortError')) {
              patch(tripId, reply.id, (m) => ({ ...m, error: errorText(e) }))
              if (e instanceof ApiError && e.status === 401) set({ passcode: undefined })
            }
          } finally {
            patch(tripId, reply.id, (m) => ({ ...m, streaming: false }))
            set({ busy: false })
          }
        },

        stop: () => controller?.abort(),

        apply: async (tripId, messageId, proposalId) => {
          const { passcode } = get()
          const target = get()
            .threads[tripId]?.find((m) => m.id === messageId)
            ?.proposals?.find((p) => p.proposal.id === proposalId)
          if (!passcode || !target) return
          patchProposal(tripId, messageId, proposalId, (p) => ({ ...p, state: 'applying', error: undefined }))
          try {
            const result = await applyProposal(passcode, tripId, target.proposal)
            useTrips.getState().replace({ version: result.version, trip: result.trip, log: result.log })
            // 自己套用的不用再通知自己
            usePrefs.getState().markSeen(tripId, result.version)
            patchProposal(tripId, messageId, proposalId, (p) => ({ ...p, state: 'applied', version: result.version }))
          } catch (e) {
            patchProposal(tripId, messageId, proposalId, (p) => ({ ...p, state: 'failed', error: errorText(e) }))
          }
        },

        dismiss: (tripId, messageId, proposalId) =>
          patchProposal(tripId, messageId, proposalId, (p) => ({ ...p, state: 'dismissed' })),

        undo: async (tripId) => {
          const { passcode } = get()
          if (!passcode) throw new Error('需要通關密語')
          const result = await undoLast(passcode, tripId)
          useTrips.getState().replace({ version: result.version, trip: result.trip, log: result.log })
          usePrefs.getState().markSeen(tripId, result.version)
          return result.summary
        },

        clear: (tripId) => set((s) => ({ threads: { ...s.threads, [tripId]: [] } })),

        applyDirect: async (tripId, ops, summary) => {
          const { passcode } = get()
          if (!passcode) throw new Error('要先在小樹那邊輸入通關密語')
          try {
            const result = await applyManual(passcode, tripId, ops, summary)
            useTrips.getState().replace({ version: result.version, trip: result.trip, log: result.log })
            usePrefs.getState().markSeen(tripId, result.version)
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) set({ passcode: undefined })
            throw new Error(errorText(e), { cause: e })
          }
        },

        ask: (tripId, text) => set((s) => ({ draft: { tripId, text, n: (s.draft?.n ?? 0) + 1 } })),
      }
    },
    {
      name: 'trip-chat',
      storage: safeStorage,
      version: 1,
      // 只存密語與最近的對話；串流中的狀態不存
      partialize: (s) => ({
        passcode: s.passcode,
        threads: Object.fromEntries(Object.entries(s.threads).map(([k, v]) => [k, v.slice(-30).map((m) => ({ ...m, streaming: false }))])),
      }),
    },
  ),
)
