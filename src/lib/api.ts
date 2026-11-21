import type { Trip } from '../types'

// 後端（worker/）的前端用戶端。網站和 API 在同一個網址，登入狀態放在瀏覽器自動帶上的 cookie 裡。
// 型別刻意不從 worker 匯入，避免把後端程式打包進網頁。

export interface Change {
  kind: 'add' | 'update' | 'remove'
  text: string
  date?: string
}
export interface LogEntry {
  version: number
  at: string
  source: 'ai' | 'manual' | 'undo' | 'sync'
  summary: string
  changes: Change[]
  /** 誰改的 */
  by?: string
}
export interface Source {
  title: string
  url: string
}
export interface Proposal {
  id: string
  summary: string
  ops: unknown[]
  changes: Change[]
  baseVersion: number
  /** 建立新行程的提案 */
  createTripId?: string
}

/** 「建立新行程」那段對話在手機上的代號（不是真的行程 id） */
export const NEW_TRIP = 'new-trip'
export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'status'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'proposal'; proposal: Proposal }
  | { type: 'error'; text: string }
  | { type: 'done' }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string[],
  ) {
    super(message)
  }
}

/** 收到 401（沒登入或登入失效）時呼叫，由登入狀態那邊設定 */
let onUnauthorized: (() => void) | undefined
export const setUnauthorizedHandler = (f: () => void) => void (onUnauthorized = f)

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { ...(init.body && { 'content-type': 'application/json' }) },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string[] }
    if (res.status === 401) onUnauthorized?.()
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`, body.details)
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', ...(body !== undefined && { body: JSON.stringify(body) }) })

// ---- 帳號 ----

export interface Account {
  id: string
  name: string
  credentials: { id: string; label: string; createdAt: string; lastUsedAt?: string }[]
}

export const fetchMe = () => request<{ user: Account }>('/api/me', { cache: 'no-store' })
export const loginOptions = () => post<{ options: unknown; challengeId: string }>('/api/auth/login/options')
export const loginVerify = (challengeId: string, response: unknown) => post<{ user: Account }>('/api/auth/login/verify', { challengeId, response })
export const inviteInfo = (code: string) => post<{ name?: string; newDevice: boolean }>('/api/auth/invite/info', { code })
/** name：新旅伴自己填的名字（加新裝置時不用） */
export const inviteOptions = (code: string, name?: string) =>
  post<{ options: unknown; challengeId: string }>('/api/auth/invite/options', { code, ...(name && { name }) })
export const inviteVerify = (code: string, challengeId: string, response: unknown) =>
  post<{ user: Account }>('/api/auth/invite/verify', { code, challengeId, response })
export const logout = () => post<{ ok: true }>('/api/auth/logout')
/** device：給自己的新裝置；person：邀請新旅伴（名字由對方加入時自己填） */
export const createInvite = (kind: 'device' | 'person') => post<{ code: string; expiresAt: string }>('/api/auth/invites', { for: kind })
export const rename = (name: string) => post<{ user: Account }>('/api/auth/profile', { name })
export const removeCredential = (id: string) => post<{ ok: true }>('/api/auth/credentials/remove', { id })

export interface Versioned {
  version: number
  trip: Trip
  /** 最近的變動紀錄，新的在前（舊的快取裡沒有） */
  log?: LogEntry[]
}

export const fetchTrips = () => request<{ trips: Versioned[] }>('/api/trips', { cache: 'no-store' })

export const applyProposal = (tripId: string, p: Proposal) =>
  post<Versioned & { changes: Change[] }>(`/api/trips/${tripId}/apply`, { ops: p.ops, summary: p.summary })

/** 直接在畫面上操作的修改（例如啟用備案），不經過小樹 */
export const applyManual = (tripId: string, ops: unknown[], summary: string) =>
  post<Versioned & { changes: Change[] }>(`/api/trips/${tripId}/apply`, { ops, summary, source: 'manual' })

/** 套用「建立新行程」的提案 */
export const createTrip = (p: Proposal) =>
  post<Versioned & { changes: Change[] }>('/api/trips', { ops: p.ops, summary: p.summary, tripId: p.createTripId })

export const undoLast = (tripId: string) => post<Versioned & { summary: string }>(`/api/trips/${tripId}/undo`)

/** 聊天：逐一 yield 後端送來的事件 */
export async function* chat(
  tripId: string,
  messages: { role: 'user' | 'assistant'; text: string; images?: { mimeType: string; data: string }[] }[],
  signal?: AbortSignal,
  /** 「看誰的行程」選的人：別人的私人小任務不會給小樹看 */
  viewer?: string,
): AsyncGenerator<ChatEvent> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(tripId === NEW_TRIP ? { newTrip: true, messages } : { tripId, messages, viewer }),
    signal,
  })
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (res.status === 401) onUnauthorized?.()
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`)
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += value
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const line = buffer.slice(0, end).trim()
      buffer = buffer.slice(end + 2)
      if (line.startsWith('data:')) yield JSON.parse(line.slice(5)) as ChatEvent
    }
  }
}
