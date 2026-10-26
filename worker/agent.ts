import { itemKinds, opsSchema } from '../src/schema'
import { applyOps, type Change, type Op } from '../src/lib/ops'
import type { Trip } from '../src/types'
import type { Env } from './env'
import { streamGenerate, type Content, type Part } from './gemini'
import { searchWeb, type Source } from './search'
import type { Stored } from './store'

// 前端看到的事件（SSE，每行 data: {json}）
export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'status'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'proposal'; proposal: Proposal }
  | { type: 'error'; text: string }
  | { type: 'done' }

export interface Proposal {
  id: string
  summary: string
  ops: Op[]
  changes: Change[]
  baseVersion: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

const MAX_STEPS = 6

// ---- 給模型的工具定義（Gemini 的 OpenAPI 子集格式）----
const str = (description?: string) => ({ type: 'string', ...(description && { description }) })
const placeSchema = {
  type: 'object',
  properties: {
    name: str('顯示名稱（繁中）'),
    local: str('當地語言名稱，例如韓文店名'),
    address: str(),
    addressLocal: { type: 'array', items: str(), description: '當地語言地址，每行一個元素' },
    mapQuery: str('地圖搜尋字串，用當地語言最準'),
  },
  required: ['name'],
}
const itemProps = {
  time: str('HH:MM，旅程當地時間'),
  end: str('HH:MM'),
  kind: { type: 'string', enum: [...itemKinds] },
  title: str(),
  who: { type: 'array', items: str(), description: '只有部分旅伴時填旅伴 id；全員就省略' },
  place: placeSchema,
  note: str('補充說明'),
  routeId: str('交通指南的路線 id，必須是既有的'),
  tentative: { type: 'boolean', description: '只是建議、尚未確定時為 true' },
  verify: str('出發前還要確認的事，例如「營業時間待確認」'),
}
const nullable = (schema: object) => ({ ...schema, nullable: true })

const tools = [
  {
    functionDeclarations: [
      {
        name: 'web_search',
        description: '上網搜尋最新資訊：營業時間、地址、交通、票價、店家推薦等。回答事實性問題前先查。韓國店家用韓文店名查通常比較準；結果是網頁摘要，要自己判斷可信度與日期。',
        parameters: { type: 'object', properties: { query: str('搜尋的問題，越具體越好') }, required: ['query'] },
      },
      {
        name: 'propose_changes',
        description:
          '提出行程修改。不會立刻生效：會顯示給使用者看，使用者按「套用」才寫入。一次可以包含多個動作。',
        parameters: {
          type: 'object',
          properties: {
            summary: str('一句話描述這次修改'),
            operations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  op: {
                    type: 'string',
                    enum: ['add_item', 'update_item', 'remove_item', 'add_checklist_item', 'add_pending', 'remove_pending'],
                  },
                  date: str('YYYY-MM-DD'),
                  title: str('update_item / remove_item：目前項目的標題（要完全相同）'),
                  time: str('update_item / remove_item：同一天有同名項目時用目前的時間區分'),
                  item: { type: 'object', properties: itemProps, required: ['kind', 'title'], description: 'add_item 的新項目' },
                  changes: {
                    type: 'object',
                    description: 'update_item 要改的欄位；要刪掉某個欄位就給 null',
                    properties: Object.fromEntries(Object.entries(itemProps).map(([k, v]) => [k, nullable(v)])),
                  },
                  group: str('add_checklist_item：清單分組名稱'),
                  label: str('add_checklist_item：清單項目文字'),
                  text: str('add_pending / remove_pending 的文字'),
                },
                required: ['op'],
              },
            },
          },
          required: ['summary', 'operations'],
        },
      },
    ],
  },
]

function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }).format(new Date())
}

function systemPrompt(trip: Trip) {
  return `你是「旅行手帖」的旅行小幫手，幫一對旅伴規劃與調整這趟旅程。

# 規則
- 一律用繁體中文（台灣用語）回答，口氣親切、簡潔，手機上好讀；不要用表格。
- 現在時間（旅程當地）：${todayIn(trip.timezone)}。
- 事實性資訊（營業時間、地址、交通、價格、推薦店家）先用 web_search 查，不要憑記憶；查不到就直說。
- 要改行程時呼叫 propose_changes。修改不會立刻生效，要等使用者按「套用」，所以不要說「已經改好」。
- 新增的地點盡量填 place.local 與 place.mapQuery（用當地語言，地圖才搜得到）。
- 回答時不要提到資料欄位名稱（例如 tentative、verify、routeId），用一般說法（「暫定」「待確認」）。
- 你推薦但使用者還沒決定的項目設 tentative: true；沒有查證到的資訊（例如營業時間）寫進 verify。
- 時間用 HH:MM、旅程當地時間；日期用 YYYY-MM-DD，必須在旅程期間內。
- 只屬於某位旅伴的項目才填 who；routeId 只能用既有的路線 id。
- 排行程時考慮移動時間與兩人分頭行動的時段，不要排到時間衝突。

# 目前的行程資料（JSON）
${JSON.stringify(trip)}`
}

const stripNulls = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stripNulls)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, stripNulls(v)]))
      : value

/** 模型給的動作先整理再驗證：add_item 的 null 欄位去掉（changes 裡的 null 有意義，保留） */
function normalizeOps(raw: unknown) {
  if (!Array.isArray(raw)) return raw
  return raw.map((op) => {
    if (!op || typeof op !== 'object') return op
    const o = op as Record<string, unknown>
    const kept = Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== null && v !== '' && (k !== 'changes' || o.op === 'update_item')))
    if (kept.item) kept.item = stripNulls(kept.item)
    return kept
  })
}

export async function runAgent(env: Env, stored: Stored, messages: ChatMessage[], emit: (e: ChatEvent) => void) {
  const contents: Content[] = messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }))

  for (let step = 0; step < MAX_STEPS; step++) {
    const parts: Part[] = []
    for await (const chunk of streamGenerate(env, {
      systemInstruction: { parts: [{ text: systemPrompt(stored.trip) }] },
      contents,
      tools,
      generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
    })) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        parts.push(part)
        if (part.text && !part.thought) emit({ type: 'text', delta: part.text })
      }
    }
    contents.push({ role: 'model', parts })

    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!)
    if (calls.length === 0) return

    const responses: Part[] = []
    for (const call of calls) {
      const args = call.args ?? {}
      let response: Record<string, unknown>
      if (call.name === 'web_search') {
        const query = String(args.query ?? '')
        emit({ type: 'status', text: `搜尋：${query}` })
        try {
          const result = await searchWeb(env, query)
          if (result.sources.length) emit({ type: 'sources', sources: result.sources })
          response = { answer: result.answer, results: result.results }
        } catch (e) {
          // 搜尋失敗不中斷對話，讓模型照實告訴使用者沒查到
          console.error('web_search failed', e)
          emit({ type: 'status', text: '搜尋暫時不能用' })
          response = { error: '搜尋暫時無法使用。請告訴使用者這次沒能上網查證，憑既有知識回答的部分要標明「未查證」，或建議稍後再問。' }
        }
      } else if (call.name === 'propose_changes') {
        const parsed = opsSchema.safeParse(normalizeOps(args.operations))
        if (!parsed.success) {
          response = { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}：${i.message}`) }
        } else {
          const applied = applyOps(stored.trip, parsed.data)
          if (applied.errors.length) {
            response = { ok: false, errors: applied.errors }
          } else {
            emit({
              type: 'proposal',
              proposal: {
                id: crypto.randomUUID(),
                summary: String(args.summary ?? '修改行程'),
                ops: parsed.data,
                changes: applied.changes,
                baseVersion: stored.version,
              },
            })
            response = { ok: true, shownToUser: applied.changes.map((c) => c.text), note: '已顯示給使用者，等使用者按「套用」才會生效。' }
          }
        }
        if (!response.ok) emit({ type: 'status', text: '修改內容有誤，重新調整中…' })
      } else {
        response = { error: `沒有 ${call.name} 這個工具` }
      }
      responses.push({ functionResponse: { ...(call.id && { id: call.id }), name: call.name, response } })
    }
    contents.push({ role: 'user', parts: responses })
  }
  emit({ type: 'text', delta: '\n（步驟太多先停在這裡，可以再告訴我要繼續。）' })
}
