import { itemKinds, opsSchema, spotCategories, triggers } from '../src/schema'
import { applyOps, type Change, type Op } from '../src/lib/ops'
import type { Trip } from '../src/types'
import type { Env } from './env'
import { GeminiError, streamGenerate, type Content, type Part } from './gemini'
import { MAX_QUERIES, searchMany, type SearchResult, type Source } from './search'
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

export interface ChatImage {
  mimeType: string
  /** base64 */
  data: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  images?: ChatImage[]
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
  spotId: str('對應地點清單裡的地點 id'),
}
const openRange = {
  type: 'object',
  properties: {
    days: { type: 'array', items: { type: 'integer' }, description: '星期幾營業：0 = 星期日 … 6 = 星期六' },
    from: str('HH:MM'),
    to: str('HH:MM；小於等於 from 代表營業到隔天，營業到午夜寫 24:00'),
  },
  required: ['days', 'from', 'to'],
}
const alternativeProps = {
  trigger: { type: 'string', enum: [...triggers], description: 'full 客滿・closed 沒開・rain 下雨・tired 太累・early 早到・late 晚到・other 其他' },
  when: str('補充觸發條件，例如「排隊超過 30 分鐘」；trigger 是 other 時必填'),
  title: str('改成做什麼'),
  kind: { type: 'string', enum: [...itemKinds], description: '跟原本不同時才填' },
  time: str('HH:MM；時間跟原本一樣就省略'),
  end: str('HH:MM'),
  place: placeSchema,
  spotId: str('地點清單裡的地點 id'),
  routeId: str('交通指南的路線 id'),
  note: str('補充說明'),
}
const spotProps = {
  place: placeSchema,
  category: { type: 'string', enum: [...spotCategories], description: 'food 餐廳・cafe 咖啡飲料・shopping 逛街・sight 景點・other 其他' },
  area: str('所在地區，例如「弘大」「延南洞」'),
  hours: str('顯示用的營業時間文字，例如「12:30–24:00（最後點餐 23:00）」；只填有可靠來源的'),
  open: { type: 'array', items: openRange, description: '營業時段，用來判斷「現在營業中」；只填有可靠來源的' },
  closed: str('公休日說明'),
  access: str('怎麼去，例如「弘大入口站 9 號出口走路 3 分」'),
  tags: { type: 'array', items: str(), description: '短標籤，例如「熱食」「宵夜」「可外帶」「雨天 OK」' },
  note: str('補充說明'),
  checkedAt: str('YYYY-MM-DD，營業時間等資訊是哪天查到的'),
  verify: str('還要確認的事'),
}
const nullable = (schema: object) => ({ ...schema, nullable: true })

const tools = [
  {
    functionDeclarations: [
      {
        name: 'web_search',
        description: '上網搜尋最新資訊：營業時間、地址、交通、票價、店家推薦等。回答事實性問題前先查。韓國店家用韓文店名查通常比較準；結果是網頁摘要，要自己判斷可信度與日期。',
        parameters: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              items: { type: 'string' },
              description: `要查的問題，每項一件事、越具體越好；要查好幾件事時全部放在同一次呼叫，會同時搜尋（最多 ${MAX_QUERIES} 項）`,
            },
          },
          required: ['queries'],
        },
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
                    enum: [
                      'add_item',
                      'update_item',
                      'remove_item',
                      'add_checklist_item',
                      'add_pending',
                      'remove_pending',
                      'add_spot',
                      'update_spot',
                      'remove_spot',
                      'add_alternative',
                      'remove_alternative',
                      'use_alternative',
                    ],
                  },
                  date: str('YYYY-MM-DD'),
                  title: str('update_item / remove_item / *_alternative：目前項目的標題（要完全相同）'),
                  time: str('update_item / remove_item / *_alternative：同一天有同名項目時用目前的時間區分'),
                  alternative: { type: 'object', properties: alternativeProps, required: ['trigger', 'title'], description: 'add_alternative 的備案' },
                  index: { type: 'integer', description: 'remove_alternative / use_alternative：第幾個備案（從 0 開始）' },
                  item: { type: 'object', properties: itemProps, required: ['kind', 'title'], description: 'add_item 的新項目' },
                  changes: {
                    type: 'object',
                    description: 'update_item 要改的欄位；要刪掉某個欄位就給 null',
                    properties: Object.fromEntries(Object.entries(itemProps).map(([k, v]) => [k, nullable(v)])),
                  },
                  group: str('add_checklist_item：清單分組名稱'),
                  label: str('add_checklist_item：清單項目文字'),
                  text: str('add_pending / remove_pending 的文字'),
                  spot: { type: 'object', properties: spotProps, required: ['place', 'category'], description: 'add_spot 的新地點（id 可省略）' },
                  ref: str('update_spot / remove_spot：地點的 id、名稱或當地語言名稱'),
                  spotChanges: {
                    type: 'object',
                    description: 'update_spot 要改的欄位；要刪掉某個欄位就給 null',
                    properties: Object.fromEntries(Object.entries(spotProps).map(([k, v]) => [k, nullable(v)])),
                  },
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
  return `你是「旅行手帖」的旅行小幫手「小樹」，幫一對旅伴規劃與調整這趟旅程。

# 規則
- 一律用繁體中文（台灣用語）回答，口氣親切、簡潔，手機上好讀；不要用表格。
- 現在時間（旅程當地）：${todayIn(trip.timezone)}。
- 事實性資訊（營業時間、地址、交通、價格、推薦店家）先用 web_search 查，不要憑記憶；查不到就直說。要查好幾件事（例如三間店的營業時間）時，一次呼叫放多個 queries，不要一件一件查。
- 要改行程時呼叫 propose_changes。修改不會立刻生效，要等使用者按「套用」，所以不要說「已經改好」。
- 這一輪沒有呼叫 propose_changes，就不要說你改了、更新了或記下了任何東西；想改的話先問使用者要不要，或直接呼叫 propose_changes。
- 新增的地點盡量填 place.local 與 place.mapQuery（用當地語言，地圖才搜得到）。
- 使用者附的圖片多半是地圖 App 的截圖（營業時間、地址、公休）、菜單或票券。從截圖讀到的營業時間可以填進地點的 hours 與 open，checkedAt 填今天，note 註明「依使用者提供的截圖」，並拿掉對應的 verify；看不清楚或被切掉的部分不要猜，照實說。
- 回答時不要提到資料欄位名稱（例如 tentative、verify、routeId），用一般說法（「暫定」「待確認」）。
- 你推薦但使用者還沒決定的項目設 tentative: true；沒有查證到的資訊（例如營業時間）寫進 verify。
- 時間用 HH:MM、旅程當地時間；日期用 YYYY-MM-DD，必須在旅程期間內。
- 只屬於某位旅伴的項目才填 who；routeId 只能用既有的路線 id。
- 排行程時考慮移動時間與兩人分頭行動的時段，不要排到時間衝突。
- 「地點清單」（spots）收已排進行程的地點與還沒排的口袋名單。使用者丟店家連結、或說「想去但還沒決定」時，用 add_spot 加進清單，不要直接排進行程。
- 加地點時一定要填 area（所在地區），而且沿用清單裡已經有的地區叫法（例如「弘大」），不要另外取新名字；真的在別區才用新的地區名。
- 把清單裡的地點排進行程時，行程項目的 spotId 填那個地點的 id；同一個地點的營業時間、交通等資訊寫在地點上，不要重複寫在行程項目裡。
- 地點的營業時間（hours、open）只填有可靠來源的（官方網站、地圖 App、近期的店家資訊頁），並填 checkedAt；部落格或摘要說法不一致時寫進 verify，不要猜。
- 推薦備案或「附近還有什麼」時，先看地點清單裡同地區、有對應標籤的地點，不夠再上網查。
- 備案（alternatives）掛在行程項目上，寫清楚什麼情況（trigger）改成做什麼。排有風險的項目時（熱門店可能客滿、戶外行程怕下雨、時間很趕），可以順便提議 1–2 個備案；備案的地點最好在同一區，時間跟原本一樣就不要填 time。
- 使用者說遇到狀況（「客滿了」「下雨了」「早到了」）時，先看那個項目有沒有對應的備案；有的話建議用 use_alternative 直接換，沒有再找新的。
- 項目的 usedAlternative 代表目前用的是備案；備案清單裡 original 為 true 的是原本的安排，換回去也是 use_alternative。

# 目前的行程資料（JSON）
${JSON.stringify(trip)}`
}

const stripNulls = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stripNulls)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, stripNulls(v)]))
      : value

/** 模型給的動作先整理再驗證：新項目、新地點的 null 欄位去掉（changes、spotChanges 裡的 null 代表刪除，保留） */
export function normalizeOps(raw: unknown) {
  if (!Array.isArray(raw)) return raw
  return raw.map((op) => {
    if (!op || typeof op !== 'object') return op
    const o = op as Record<string, unknown>
    const kept = Object.fromEntries(
      Object.entries(o).filter(
        ([k, v]) => v !== null && v !== '' && (k !== 'changes' || o.op === 'update_item') && (k !== 'spotChanges' || o.op === 'update_spot'),
      ),
    )
    if (kept.item) kept.item = stripNulls(kept.item)
    if (kept.spot) kept.spot = stripNulls(kept.spot)
    if (kept.alternative) kept.alternative = stripNulls(kept.alternative)
    return kept
  })
}

/**
 * 搜尋做完了、模型卻塞車寫不出回答時，直接把搜尋到的重點整理出來，不讓使用者只看到錯誤訊息。
 * 這一步不需要呼叫模型。
 */
export function searchDigest(results: SearchResult[]) {
  const sections = results.map((r) => {
    if ('error' in r) return `**${r.query}**\n這一項沒查到。`
    if (r.answer) return `**${r.query}**\n${r.answer.slice(0, 400)}`
    const lines = r.results.slice(0, 2).map((x) => `- [${x.title || x.url}](${x.url})：${x.snippet.replace(/\s+/g, ' ').slice(0, 120)}`)
    return `**${r.query}**\n${lines.join('\n') || '這一項沒查到。'}`
  })
  return [
    '小樹現在有點塞車，沒辦法整理成完整的回答，先給你搜尋到的重點：',
    ...sections,
    '（這些是網頁摘要，還沒經過整理，可以點下面的來源確認；過一下再問一次，小樹會整理得更完整。）',
  ].join('\n\n')
}

const busy = (e: unknown) => e instanceof GeminiError && (e.status === 503 || e.status === 429)

export async function runAgent(env: Env, stored: Stored, messages: ChatMessage[], emit: (e: ChatEvent) => void) {
  const contents: Content[] = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }, ...(m.images ?? []).map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data } }))],
  }))
  const searched: SearchResult[] = []
  const onRetry = () => emit({ type: 'status', text: '小樹那邊有點塞，再試一次…' })

  for (let step = 0; step < MAX_STEPS; step++) {
    const parts: Part[] = []
    try {
      for await (const chunk of streamGenerate(
        env,
        {
          systemInstruction: { parts: [{ text: systemPrompt(stored.trip) }] },
          contents,
          tools,
          generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
        },
        onRetry,
      )) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          parts.push(part)
          if (part.text && !part.thought) emit({ type: 'text', delta: part.text })
        }
      }
    } catch (e) {
      // 已經回答到一半就不補；還沒開口、但手上有搜尋結果時，先把搜尋到的給使用者
      if (!busy(e) || searched.length === 0 || parts.some((p) => p.text && !p.thought)) throw e
      console.error('模型塞車，改給搜尋摘要', e)
      emit({ type: 'text', delta: searchDigest(searched) })
      return
    }
    contents.push({ role: 'model', parts })

    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!)
    if (calls.length === 0) return

    const responses: Part[] = []
    for (const call of calls) {
      const args = call.args ?? {}
      let response: Record<string, unknown>
      if (call.name === 'web_search') {
        const raw = Array.isArray(args.queries) ? args.queries : [args.query]
        const queries = raw.filter((q): q is string => typeof q === 'string')
        emit({ type: 'status', text: `搜尋：${queries.slice(0, MAX_QUERIES).join('、')}` })
        const found = await searchMany(env, queries)
        if (found.sources.length) emit({ type: 'sources', sources: found.sources })
        if (found.failed === found.results.length) {
          emit({ type: 'status', text: '搜尋暫時不能用' })
          response = { error: '搜尋暫時無法使用。請告訴使用者這次沒能上網查證，憑既有知識回答的部分要標明「未查證」，或建議稍後再問。' }
        } else {
          response = { results: found.results }
          searched.push(...found.results)
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
