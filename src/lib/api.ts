import type { Trip } from '../types'

// 聊天框後端（worker/）的前端用戶端。型別刻意不從 worker 匯入，避免把後端程式打包進網頁。
export const API_BASE = import.meta.env.VITE_API_BASE as string | undefined

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
}
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

async function request<T>(path: string, init: RequestInit & { passcode?: string } = {}): Promise<T> {
  if (!API_BASE) throw new ApiError(0, '沒有設定後端網址')
  const { passcode, ...rest } = init
  const res = await fetch(API_BASE + path, {
    ...rest,
    headers: {
      ...(rest.body && { 'content-type': 'application/json' }),
      ...(passcode && { authorization: `Bearer ${passcode}` }),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string[] }
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`, body.details)
  }
  return res.json() as Promise<T>
}

export interface Versioned {
  version: number
  trip: Trip
  /** 最近的變動紀錄，新的在前（舊的快取裡沒有） */
  log?: LogEntry[]
}

export const fetchTrips = () => request<{ trips: Versioned[] }>('/api/trips', { cache: 'no-store' })

export const checkPasscode = (passcode: string) => request<{ ok: true }>('/api/auth', { method: 'POST', passcode })

export const applyProposal = (passcode: string, tripId: string, p: Proposal) =>
  request<Versioned & { changes: Change[] }>(`/api/trips/${tripId}/apply`, {
    method: 'POST',
    passcode,
    body: JSON.stringify({ ops: p.ops, summary: p.summary }),
  })

/** 直接在畫面上操作的修改（例如啟用備案），不經過小樹 */
export const applyManual = (passcode: string, tripId: string, ops: unknown[], summary: string) =>
  request<Versioned & { changes: Change[] }>(`/api/trips/${tripId}/apply`, {
    method: 'POST',
    passcode,
    body: JSON.stringify({ ops, summary, source: 'manual' }),
  })

export const undoLast = (passcode: string, tripId: string) =>
  request<Versioned & { summary: string }>(`/api/trips/${tripId}/undo`, { method: 'POST', passcode })

/** 聊天：逐一 yield 後端送來的事件 */
export async function* chat(
  passcode: string,
  tripId: string,
  messages: { role: 'user' | 'assistant'; text: string }[],
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  if (!API_BASE) throw new ApiError(0, '沒有設定後端網址')
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${passcode}` },
    body: JSON.stringify({ tripId, messages }),
    signal,
  })
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
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
