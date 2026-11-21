import { itemKinds, mapProviders, opsSchema, scenes, spotCategories, tripIcons, triggers } from '../src/schema'
import { applyOps, type Change, type Op } from '../src/lib/ops'
import { freeWindows, overlaps } from '../src/lib/plan'
import { hidePrivate } from '../src/lib/visibility'
import type { Trip } from '../src/types'
import type { Env } from './env'
import { GeminiError, modelLabel, streamGenerate, type Content, type Part } from './gemini'
import { MAX_QUERIES, searchMany, type SearchResult, type Source } from './search'
import type { Stored } from './store'

// 前端看到的事件（SSE，每行 data: {json}）
export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'status'; text: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'proposal'; proposal: Proposal }
  /** 這次實際回答的模型（選的模型塞車時會改用別的） */
  | { type: 'model'; id: string; label: string }
  | { type: 'error'; text: string }
  | { type: 'done' }

export interface Proposal {
  id: string
  summary: string
  ops: Op[]
  changes: Change[]
  baseVersion: number
  /** 建立新行程的提案：套用時用這個 id 建立（伺服器會再檢查、重複時換一個） */
  createTripId?: string
}

/** edit：改既有的行程；create：從空白草稿建立新行程 */
export type AgentMode = 'edit' | 'create'

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
/** 一輪對話最多搜尋幾次 */
const MAX_SEARCHES = 2

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
  fixed: { type: 'boolean', description: '時間不能動的行程（班機、演唱會預設就是）' },
  todo: {
    type: 'object',
    properties: { done: { type: 'boolean' } },
    required: ['done'],
    description: '小任務才填：{ done: false }',
  },
  for: { type: 'object', properties: { time: str('HH:MM'), title: str() }, required: ['title'], description: '小任務是為了哪個行程' },
  private: { type: 'boolean', description: '驚喜用的私人小任務，只有負責人看得到' },
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
const strList = (description?: string) => ({ type: 'array', items: str(), ...(description && { description }) })
const flightEnd = {
  type: 'object',
  properties: {
    code: str('機場代碼，例如 TPE、PUS'),
    name: str('機場名稱（繁中），例如「桃園」「金海」'),
    terminal: str('航廈，例如 T1；不知道就寫「待確認」'),
    time: str('HH:MM，當地時間'),
    tzLabel: str('時區說明，例如「台灣時間」「韓國時間」'),
  },
  required: ['code', 'name', 'terminal', 'time', 'tzLabel'],
}
const flightProps = {
  label: str('例如「去程」「回程」'),
  date: str('YYYY-MM-DD，出發日'),
  airline: str(),
  number: str('航班號碼，例如 BR170'),
  aircraft: str(),
  cabin: str('艙等'),
  duration: str('飛行時間，例如「2 小時 5 分」'),
  from: flightEnd,
  to: flightEnd,
  notes: strList('補充，例如行李額度、報到櫃台；訂位代號可以寫在這裡'),
}
const stayProps = {
  place: placeSchema,
  checkIn: str('例如「12/22 15:00 後」'),
  checkOut: str('例如「12/26 11:00 前」'),
  notes: strList('補充，例如自助入住方式；訂位代號可以寫在這裡'),
  verify: str('還要確認的事'),
}
const routeOption = {
  type: 'object',
  properties: {
    label: str('方案名稱'),
    mode: str('交通方式，例如「地鐵」「計程車」「機場巴士」'),
    tab: str('分頁上的短名稱'),
    recommended: { type: 'boolean', description: '推薦的方案；每條路線剛好一個' },
    duration: str('例如「約 50 分」'),
    cost: str('例如「₩1,500」'),
    steps: strList('怎麼走，一步一個元素'),
    pros: strList(),
    cons: strList(),
    verify: str(),
  },
  required: ['label', 'mode', 'duration', 'cost', 'steps'],
}
const routeProps = {
  id: str('英文小寫與連字號，例如 airport-to-hotel；省略會自動產生'),
  title: str('例如「金海機場 → 住宿」'),
  who: { type: 'array', items: str(), description: '只有部分旅伴走這段時填旅伴 id' },
  when: str('什麼時候走，例如「12/22 抵達後」'),
  summary: str('一句話說明'),
  options: { type: 'array', items: routeOption, description: '交通方案，至少一個，剛好一個 recommended' },
  fallback: strList('出狀況時的備案'),
}
const tipProps = {
  title: str(),
  body: strList('內容，一段一個元素'),
  level: { type: 'string', enum: ['info', 'warn'], description: 'warn 是要特別注意的' },
  links: { type: 'array', items: { type: 'object', properties: { label: str(), url: str() }, required: ['label', 'url'] } },
}
const tripInfoProps = {
  title: str('行程名稱，例如「釜山」'),
  subtitle: str('副標題，例如「生日旅行」'),
  icon: { type: 'string', enum: [...tripIcons], description: '首頁卡片的插圖' },
  timezone: str('IANA 時區，例如 Asia/Seoul、Asia/Tokyo'),
  mapProvider: { type: 'string', enum: [...mapProviders], description: '韓國用 naver、日本用 google' },
  driverPhrase: str('給計程車司機看的那句話（當地語言），例如「이 주소로 가 주세요」'),
}
const travelerProps = { id: str('英文小寫；省略會自動產生'), name: str(), color: str('淺色底色，例如 #FFCCB8'), ink: str('文字色') }
const changesOf = (props: Record<string, object>, description: string) => ({
  type: 'object',
  description,
  properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, nullable(v)])),
})

/** 其他區塊的修改動作（基本資料、天數、旅伴、班機、住宿、交通、資訊、清單分組） */
const sectionOpNames = [
  'update_trip',
  'set_dates',
  'update_day',
  'add_traveler',
  'update_traveler',
  'remove_traveler',
  'add_flight',
  'update_flight',
  'remove_flight',
  'add_stay',
  'update_stay',
  'remove_stay',
  'add_route',
  'update_route',
  'remove_route',
  'add_tip',
  'update_tip',
  'remove_tip',
  'add_checklist_group',
  'update_checklist_group',
  'remove_checklist_group',
]

const tools = [
  {
    functionDeclarations: [
      {
        name: 'web_search',
        description:
          '上網搜尋行程資料裡沒有、而且會變動的外部資訊（營業時間、價格、新店家推薦、班次、天氣）。問行程本身或調整行程時不需要用。韓國店家用韓文店名查通常比較準；結果是網頁摘要，要自己判斷可信度與日期。',
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
        name: 'find_free_time',
        description:
          '算出某一天在固定行程（班機、演唱會、標了固定的項目）之間的空檔，以及空檔裡目前排了哪些彈性項目。要回答「有多少時間」「早到了可以做什麼」「來不來得及」時先用它，不要自己算時間。',
        parameters: {
          type: 'object',
          properties: {
            date: str('YYYY-MM-DD'),
            who: str('只看某位旅伴的行程時填旅伴 id'),
            after: str('HH:MM，從這個時間開始算（例如現在幾點）'),
          },
          required: ['date'],
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
            tripId: str('只有建立新行程時填：英文小寫加連字號的 id，例如 busan-2026-12'),
            operations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  op: {
                    type: 'string',
                    enum: [
                      'add_item',
                      'insert_item',
                      'update_item',
                      'remove_item',
                      'add_checklist_item',
                      'remove_checklist_item',
                      'update_checklist_item',
                      'check_checklist_item',
                      'add_pending',
                      'remove_pending',
                      'add_spot',
                      'update_spot',
                      'remove_spot',
                      'add_alternative',
                      'remove_alternative',
                      'use_alternative',
                      'shift_items',
                      'complete_task',
                      ...sectionOpNames,
                    ],
                  },
                  date: str('YYYY-MM-DD；update_day 是要改的那一天'),
                  title: str('update_item / remove_item / *_alternative：目前項目的標題（要完全相同）；add_checklist_group / update_checklist_group：分組名稱（update 時是新的名稱）'),
                  time: str('update_item / remove_item / *_alternative：同一天有同名項目時用目前的時間區分'),
                  alternative: { type: 'object', properties: alternativeProps, required: ['trigger', 'title'], description: 'add_alternative 的備案' },
                  index: { type: 'integer', description: 'remove_alternative / use_alternative：第幾個備案（從 0 開始）' },
                  from: str('shift_items：從幾點開始挪（HH:MM，含）'),
                  until: str('shift_items：挪到幾點為止（不含）；省略 = 下一個固定行程之前'),
                  minutes: { type: 'integer', description: 'shift_items：挪幾分鐘，正數往後延、負數提前' },
                  who: str('shift_items：只挪某位旅伴自己的項目時填旅伴 id'),
                  done: { type: 'boolean', description: 'complete_task / check_checklist_item：true 完成（勾掉）、false 改回還沒完成' },
                  item: {
                    type: 'object',
                    properties: itemProps,
                    required: ['kind', 'title'],
                    description: 'add_item / insert_item 的新項目（insert_item 一定要有 time 與 end）',
                  },
                  changes: {
                    type: 'object',
                    description: 'update_item 要改的欄位；要刪掉某個欄位就給 null',
                    properties: Object.fromEntries(Object.entries(itemProps).map(([k, v]) => [k, nullable(v)])),
                  },
                  group: str('add_checklist_item：清單分組名稱；remove_checklist_item：不同分組有同樣文字時用來區分'),
                  label: str('add_checklist_item / update_checklist_item：清單項目文字（update 時是新的文字）'),
                  text: str('add_pending / remove_pending 的文字'),
                  spot: { type: 'object', properties: spotProps, required: ['place', 'category'], description: 'add_spot 的新地點（id 可省略）' },
                  ref: str(
                    '要改的那一筆：update_spot / remove_spot 是地點的 id、名稱或當地語言名稱；*_checklist_item 是清單項目的 id 或文字；*_flight 是航班號碼或標籤；*_stay 是住宿名稱；*_route 是路線 id 或標題；*_tip 是小提醒標題；*_traveler 是旅伴 id 或名字；*_checklist_group 是分組名稱',
                  ),
                  spotChanges: {
                    type: 'object',
                    description: 'update_spot 要改的欄位；要刪掉某個欄位就給 null',
                    properties: Object.fromEntries(Object.entries(spotProps).map(([k, v]) => [k, nullable(v)])),
                  },
                  tripChanges: changesOf(tripInfoProps, 'update_trip：要改的行程基本資料（日期用 set_dates）'),
                  startDate: str('set_dates：YYYY-MM-DD'),
                  endDate: str('set_dates：YYYY-MM-DD'),
                  dayChanges: changesOf({ title: str('這一天的標題，例如「海雲台散步」'), scene: { type: 'string', enum: [...scenes], description: 'depart 出發・concert 活動・stroll 散步・home 回家' } }, 'update_day：要改的欄位'),
                  traveler: { type: 'object', properties: travelerProps, required: ['name'], description: 'add_traveler 的新旅伴' },
                  travelerChanges: changesOf(travelerProps, 'update_traveler：要改的欄位'),
                  flight: { type: 'object', properties: flightProps, required: ['label', 'date', 'airline', 'number', 'duration', 'from', 'to'], description: 'add_flight 的新班機' },
                  flightChanges: changesOf(flightProps, 'update_flight：要改的欄位；from / to 只給要改的部分（例如只給 time）'),
                  stay: { type: 'object', properties: stayProps, required: ['place', 'checkIn', 'checkOut'], description: 'add_stay 的新住宿' },
                  stayChanges: changesOf(stayProps, 'update_stay：要改的欄位；place 只給要改的部分'),
                  route: { type: 'object', properties: routeProps, required: ['title', 'summary', 'options'], description: 'add_route 的新路線' },
                  routeChanges: changesOf(routeProps, 'update_route：要改的欄位'),
                  section: str('add_tip：資訊分頁的分組名稱（沒有會自動建立）；update_tip / remove_tip：不同分組有同樣標題時用來區分'),
                  tip: { type: 'object', properties: tipProps, required: ['title', 'body'], description: 'add_tip 的新小提醒' },
                  tipChanges: changesOf(tipProps, 'update_tip：要改的欄位'),
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

const createIntro = `你是「旅行手帖」的旅行小幫手「小樹」。使用者要建立一趟新的旅行。
下面的「目前的行程資料」是一份空白草稿，你用 propose_changes 把它填好；使用者按「套用」時才會真的建立這趟旅行，之後就能在那趟旅行裡繼續改。

# 建立新行程
- 必要的資訊是目的地和出發、回來的日期；使用者沒說清楚就先問，不要猜日期。
- 資訊夠了就呼叫 propose_changes，一次送出：update_trip（title 用目的地，例如「釜山」；subtitle 寫這趟的主題，例如「生日旅行」；timezone 用 IANA 名稱；mapProvider：韓國用 naver，日本和其他地方用 google；driverPhrase 用當地語言寫「請載我到這個地址」）、set_dates、每一天用 update_day 取個簡短的標題；並在 tripId 填英文小寫加連字號的 id（例如 busan-2026-12）。
- 使用者有給班機或住宿資料（截圖、確認信、貼的文字）時一起加進去（見下面的規則）；還不知道的細節不要編，用 add_pending 記下還缺什麼（例如「回程班機」「住宿」）。
- 可以順便建一份出發前的準備清單：用 add_checklist_item 加項目，group 寫分組名稱（例如「證件與錢」「App 與網路」，分組不存在會自動建立）；項目要符合目的地（例如韓國的 Naver Map、T-money）。
- 旅伴已經依帳號建好了，使用者沒提就不要改。
- 這是新行程，套用之前沒有任何資料會被蓋掉，不用擔心；不要提到「草稿」這個詞，說「行程」就好。
`

function systemPrompt(trip: Trip, viewer?: string, mode: AgentMode = 'edit') {
  const me = viewer ? trip.travelers.find((t) => t.id === viewer) : undefined
  return `${mode === 'create' ? createIntro : '你是「旅行手帖」的旅行小幫手「小樹」，幫一對旅伴規劃與調整這趟旅程。\n'}

# 什麼時候上網搜尋
- 先看下面的行程資料與地點清單，能直接回答就直接回答，不要搜尋。
- 要搜尋：行程和地點清單裡沒有、而且會變動的外部資訊，例如營業時間或公休、價格、推薦新的店家或景點、交通班次、天氣、活動公告。這類資訊不要憑記憶，查不到就直說。
- 不用搜尋：問行程本身（幾點、去哪、誰去）、調整時間或順序（延後、提早、插入、挪動）、加小任務或備案、標成完成、整理或比較已經有的安排、閒聊；使用者已經給了資訊（貼的文字、截圖、連結）；地點清單裡已經有確認過的資料（有確認日期）。
- 真的要搜時，一次呼叫把所有要查的事放進 queries，不要一件一件查。

# 規則
- 一律用繁體中文（台灣用語）回答，口氣親切、簡潔，手機上好讀；不要用表格，也不要用 emoji。
- 現在時間（旅程當地）：${todayIn(trip.timezone)}。
- 現在用這支手機的是：${me ? `「${me.name}」（id: ${me.id}）` : '還沒選（兩個人都可能）'}。
- 要改行程時呼叫 propose_changes。修改不會立刻生效，要等使用者按「套用」，所以不要說「已經改好」。呼叫 propose_changes 之前不要提到「套用」按鈕；等工具回傳 ok: true 之後，才請使用者按「套用」。
- 使用者貼了地圖 App 的分享連結（例如 naver.me/…）時，把它原樣填進對應地點的 place.mapLink（update_spot 時 spotChanges.place 只要給 mapLink 就好，其他欄位會沿用）。
- 地圖連結（mapLink）只能用搜尋結果裡真的出現過、或使用者貼的網址，不要自己組 Naver 連結；沒有就只填 local 與 mapQuery（用當地語言的完整店名，分店名也寫上，地圖 App 才搜得到正確的那間）。回答的文字裡也不要附自己組的地圖網址；要給地圖，就請使用者在地點清單或行程卡片按「地圖」（會用店名直接在地圖 App 裡搜尋）。
- 清單（checklist）可以用 add_checklist_item 新增、update_checklist_item 改文字、remove_checklist_item 刪除、check_checklist_item 勾掉或取消勾選（done），ref 填目前的項目文字。項目的 done: true 代表已經準備好了，兩個人看到的是同一份。
- 修改被系統退回時，照錯誤訊息直接修正再送，回答裡不要提到退回、重試或道歉，只講最後的結果。
- 這一輪沒有呼叫 propose_changes，就不要說你改了、更新了或記下了任何東西；想改的話先問使用者要不要，或直接呼叫 propose_changes。
- 新增的地點盡量填 place.local 與 place.mapQuery（用當地語言，地圖才搜得到）。
- 使用者附的圖片多半是地圖 App 的截圖（營業時間、地址、公休）、菜單或票券。從截圖讀到的營業時間可以填進地點的 hours 與 open，checkedAt 填今天，note 註明「依使用者提供的截圖」，並拿掉對應的 verify；看不清楚或被切掉的部分不要猜，照實說。
- 回答時不要提到資料欄位名稱（例如 tentative、verify、routeId），用一般說法（「暫定」「待確認」）。
- 你推薦但使用者還沒決定的項目設 tentative: true；沒有查證到的資訊（例如營業時間）寫進 verify。
- 時間用 HH:MM、旅程當地時間；日期用 YYYY-MM-DD，必須在旅程期間內。
- 只屬於某位旅伴的項目才填 who；routeId 只能用既有的路線 id。
- 排行程時考慮移動時間與兩人分頭行動的時段，不要排到時間衝突：同一個人同一時間只能有一件事（系統會擋下重疊的修改）。兩個人分頭行動的時段，新加的項目要用 who 指定給有空的那個人。
- 把新項目加進已經有安排的時段時，用 insert_item（要有 time 與 end）：系統會自動把後面被蓋到的彈性項目往後推，中間有空檔就吸收，推到會撞固定行程時會回報。不要用 add_item 直接塞進去。推不動時，跟使用者商量要縮短、拿掉哪一項，或調整固定行程（例如取票時間還有餘裕）。
- 要延後或提早某件事，是「挪動」它：改 time，結束時間會自動跟著移；不要只改 end（那是拉長）。交通的長度不要改，除非使用者說路上會比較久。要拉長某件事（例如逛街多逛一點），才改 end，並把後面受影響的項目一起挪。
- 插入或挪動之後，回答時用一兩句話說明這一天的順序怎麼變了，讓使用者套用前就知道；說明要跟實際送出的修改一致，沒有改到的項目不要說有改。
- 「地點清單」（spots）收已排進行程的地點與還沒排的口袋名單。使用者丟店家連結、或說「想去但還沒決定」時，用 add_spot 加進清單，不要直接排進行程。
- 加地點時一定要填 area（所在地區），而且沿用清單裡已經有的地區叫法（例如「弘大」），不要另外取新名字；真的在別區才用新的地區名。
- 把清單裡的地點排進行程時，行程項目的 spotId 填那個地點的 id；同一個地點的營業時間、交通等資訊寫在地點上，不要重複寫在行程項目裡。
- 地點的營業時間（hours、open）只填有可靠來源的（官方網站、地圖 App、近期的店家資訊頁），並填 checkedAt；部落格或摘要說法不一致時寫進 verify，不要猜。
- 推薦備案或「附近還有什麼」時，先看地點清單裡同地區、有對應標籤的地點，不夠再上網查。
- 備案（alternatives）掛在行程項目上，寫清楚什麼情況（trigger）改成做什麼。排有風險的項目時（熱門店可能客滿、戶外行程怕下雨、時間很趕），可以順便提議 1–2 個備案；備案的地點最好在同一區，時間跟原本一樣就不要填 time。
- 使用者說遇到狀況（「客滿了」「下雨了」「早到了」）時，先看那個項目有沒有對應的備案；有的話建議用 use_alternative 直接換，沒有再找新的。
- 固定行程（班機、演唱會、fixed 為 true 的項目）時間不能動。行程有延誤或提早時，用 shift_items 把彈性項目整段挪動（一定要填 from 與 minutes，例如 { op: 'shift_items', date, from: '12:00', minutes: 30 }），預設只挪到下一個固定行程之前；挪不動（會撞到固定行程）時，改建議刪掉或縮短某個彈性項目，或改用備案。
- 算空檔、來不來得及時先呼叫 find_free_time，不要自己做時間加減。
- 小任務是某個人要順手完成的事（例如先外帶宵夜回住宿）：kind 用 task，todo 填 { done: false }，who 填負責人，time–end 是可以做的時間範圍，for 寫是為了哪個行程。調整行程時看到可以順路處理的事，可以提議建立小任務。
- 驚喜類的小任務設 private: true，只有負責人看得到；建立私人小任務時，回答也不要寫出會被另一個人看到的細節。標成完成用 complete_task。
- 除了每天的行程項目，你也可以改這趟旅程的其他區塊，各有新增／修改／刪除：基本資料（update_trip：名稱、時區、地圖 App、給司機看的那句話）、旅程日期（set_dates）、每天的標題與插圖（update_day）、旅伴（*_traveler）、班機（*_flight）、住宿（*_stay）、交通指南（*_route）、資訊分頁的小提醒（*_tip，依 section 分組）、清單分組（*_checklist_group）。
- 使用者給了班機、住宿的資料（訂位確認信、截圖、貼的文字）時：用 add_flight / add_stay 填進對應區塊，同時把班機排進那一天的行程（kind: flight、fixed: true，title 寫「航班號碼 出發地 → 目的地」），入住、退房也排進行程；地址有當地語言的話填 place.addressLocal（給司機看的卡片會用）。看不清楚的欄位寫「待確認」或放進 verify，不要猜。
- 訂位代號可以記在班機或住宿的 notes。護照號碼、身分證號碼、信用卡號一律不要存，回答裡也不要複述；截圖裡有的話直接略過（系統也會擋下）。
- 換成備案就是狀態交換：換上來的就是行程，被換掉的變成備案（original 為 true 的是「原本排的」），換回去也是 use_alternative，不想要了可以 remove_alternative。usedAlternative 只是系統內部記錄，回答時不用提。

# 目前的行程資料（JSON）
${JSON.stringify(trip)}`
}

const stripNulls = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stripNulls)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, stripNulls(v)]))
      : value

/** 「要改的欄位」各自屬於哪個動作；模型常把不相干的空物件也一起送來 */
const changesFor: Record<string, string> = {
  changes: 'update_item',
  spotChanges: 'update_spot',
  tripChanges: 'update_trip',
  dayChanges: 'update_day',
  travelerChanges: 'update_traveler',
  flightChanges: 'update_flight',
  stayChanges: 'update_stay',
  routeChanges: 'update_route',
  tipChanges: 'update_tip',
}
/** 新增的那一筆（裡面的 null 都是模型沒填，直接去掉） */
const newEntities = ['item', 'spot', 'alternative', 'traveler', 'flight', 'stay', 'route', 'tip']

/**
 * 模型給的動作先整理再驗證：新增的那一筆裡的 null 欄位去掉；
 * 「要改的欄位」第一層的 null 代表刪除、保留，更深一層（例如只改起飛時間的 from）的 null 去掉
 */
export function normalizeOps(raw: unknown) {
  if (!Array.isArray(raw)) return raw
  return raw.map((op) => {
    if (!op || typeof op !== 'object') return op
    const o = op as Record<string, unknown>
    const kept = Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== null && v !== '' && (!(k in changesFor) || changesFor[k] === o.op)))
    for (const k of newEntities) if (kept[k]) kept[k] = stripNulls(kept[k])
    for (const k of Object.keys(changesFor))
      if (kept[k] && typeof kept[k] === 'object')
        kept[k] = Object.fromEntries(Object.entries(kept[k] as object).map(([f, v]) => [f, v && typeof v === 'object' && !Array.isArray(v) ? stripNulls(v) : v]))
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

/**
 * 送出修改前，在程式裡把規則做實（光寫在提示裡模型不一定照做）：
 * - 新地點一定要有地區
 * - 地圖連結只能用搜尋結果裡出現過、或使用者自己貼的網址；其他的（多半是模型編的）拿掉，改用店名搜尋
 */
export function checkAgentOps(raw: unknown, allowedLinks: Map<string, string>) {
  const problems: string[] = []
  const notes: string[] = []
  const stripLink = (place: unknown) => {
    const p = place as { mapLink?: unknown } | null | undefined
    if (p && typeof p === 'object' && typeof p.mapLink === 'string' && allowedLinks.has(linkKey(p.mapLink))) {
      // 使用者貼的可能沒有 https://：存成完整網址
      p.mapLink = allowedLinks.get(linkKey(p.mapLink))
    } else if (p && typeof p === 'object' && typeof p.mapLink === 'string') {
      notes.push(`地圖連結 ${p.mapLink} 不是搜尋結果或使用者給的網址，已拿掉，改用 mapQuery 搜尋`)
      delete p.mapLink
    }
  }
  if (Array.isArray(raw))
    for (const op of raw as Record<string, Record<string, unknown> | undefined>[]) {
      if (!op || typeof op !== 'object') continue
      if (op.op === ('add_spot' as unknown) && op.spot && !op.spot.area) problems.push(`add_spot「${String((op.spot.place as { name?: string })?.name ?? '')}」要填 area（沿用清單裡已經有的地區叫法）`)
      for (const holder of [op.spot, op.item, op.alternative, op.changes, op.spotChanges, op.stay, op.stayChanges]) if (holder) stripLink(holder.place)
    }
  problems.push(...sensitiveData(raw))
  return { problems, notes }
}

/** 信用卡號的檢查碼（Luhn），排除剛好 16 位數的電話或訂單編號 */
function luhn(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2
    sum += d
  }
  return sum % 10 === 0
}

/** 不存的個資：護照號碼、台灣身分證字號、信用卡號（行程大家都看得到，外洩的代價也大） */
export function sensitiveData(raw: unknown) {
  const text = JSON.stringify(raw ?? '')
  const found: string[] = []
  if (/護照(?:號碼|號)?[^\d\w]{0,6}[A-Z0-9]{6,9}/i.test(text) || /passport\s*(?:no\.?|number)?\s*[:：]?\s*[A-Z0-9]{6,9}/i.test(text)) found.push('護照號碼')
  if (/(?<![A-Za-z0-9])[A-Z][12]\d{8}(?!\d)/.test(text)) found.push('身分證字號')
  for (const m of text.matchAll(/(?<!\d)(?:\d{4}[ -]?){3}\d{4}(?!\d)/g)) if (luhn(m[0].replace(/\D/g, ''))) found.push('信用卡號')
  return [...new Set(found)].map((what) => `修改內容裡有${what}，這類個資不能存進行程；把它拿掉再送一次（訂位代號可以保留）`)
}

/** 這次修改新造成的時間重疊（原本就有的不算，免得被舊資料卡住） */
export function newOverlaps(before: Trip, after: Trip) {
  return after.days.flatMap((day) => {
    const old = new Set(overlaps(before.days.find((d) => d.date === day.date) ?? { ...day, items: [] }))
    return overlaps(day)
      .filter((o) => !old.has(o))
      .map((o) => `時間重疊（同一個人同時有兩件事）：${day.date.slice(5).replace('-', '/')} ${o}`)
  })
}

const lengthOf = (i: { time?: string; end?: string }) =>
  i.time && i.end ? Number(i.end.slice(0, 2)) * 60 + Number(i.end.slice(3)) - (Number(i.time.slice(0, 2)) * 60 + Number(i.time.slice(3))) : undefined

/** 交通的長度被改了 15 分鐘以上（多半是想延後出發卻只改了結束時間） */
export function transitLengthChanges(before: Trip, after: Trip) {
  return after.days.flatMap((day) => {
    const old = before.days.find((d) => d.date === day.date)
    return day.items.flatMap((i) => {
      if (i.kind !== 'transit') return []
      const was = old?.items.find((o) => o.kind === 'transit' && o.title === i.title)
      const a = was && lengthOf(was)
      const b = lengthOf(i)
      return a !== undefined && b !== undefined && Math.abs(a - b) >= 15
        ? [`交通「${i.title}」的長度從 ${a} 分變成 ${b} 分；移動時間通常不會變，要延後出發請改出發時間（time），結束時間會自動跟著移`]
        : []
    })
  })
}

// 地圖 App 的分享連結常被貼成沒有 https:// 的樣子（naver.me/xxxx），一樣要認得
const MAP_HOSTS = /^(naver\.me|map\.naver\.com|m\.map\.naver\.com|m\.place\.naver\.com|place\.naver\.com|place\.map\.kakao\.com|map\.kakao\.com|kko\.to|maps\.app\.goo\.gl|goo\.gl|maps\.google\.com|google\.com)\//i
/** 比對用：去掉 https://、www.、結尾的斜線 */
export const linkKey = (url: string) => url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase()
export function urlsIn(text: string) {
  // 網址只含英數與網址符號：遇到中文、全形標點、括號就停
  const chars = "[\\w\\-.~:/?#@!$&'*+,;=%]"
  const withScheme = text.match(new RegExp(`https?://${chars}+`, 'gi')) ?? []
  const bare = (text.match(new RegExp(`(?:www\\.)?[a-z0-9-]+(?:\\.[a-z0-9-]+)+/${chars}*`, 'gi')) ?? []).filter((u) =>
    MAP_HOSTS.test(u.replace(/^www\./i, '')),
  )
  // 同一個網址只留一個（有 https 的那個優先）
  const found = new Map<string, string>()
  for (const u of [...withScheme, ...bare.map((b) => `https://${b}`)]) if (!found.has(linkKey(u))) found.set(linkKey(u), u)
  return [...found.values()]
}

const busy = (e: unknown) => e instanceof GeminiError && (e.status === 503 || e.status === 429)

export async function runAgent(
  env: Env,
  stored: Stored,
  messages: ChatMessage[],
  emit: (e: ChatEvent) => void,
  viewer?: string,
  mode: AgentMode = 'edit',
  preferredModel?: string,
) {
  // 別人的私人小任務不給模型看，免得說溜嘴；修改還是套在完整的行程上
  const visible = hidePrivate(stored.trip, viewer)
  const contents: Content[] = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }, ...(m.images ?? []).map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data } }))],
  }))
  const searched: SearchResult[] = []
  const onRetry = () => emit({ type: 'status', text: '小樹那邊有點塞，再試一次…' })
  // 系統提示含整份行程，只產生一次（每一步都重新產生很吃 CPU）
  const prompt = systemPrompt(visible, viewer, mode)
  // 可以用的地圖連結：使用者貼的、搜尋結果裡出現過的
  const allowedLinks = new Map(
    messages.filter((m) => m.role === 'user').flatMap((m) => urlsIn(m.text)).map((u) => [linkKey(u), u] as const),
  )
  // 說了「套用」卻沒有產生修改時要補一句，免得使用者找不到按鈕
  let proposals = 0
  let saidApply = false
  let searches = 0
  const finish = () => {
    if (saidApply && proposals === 0) emit({ type: 'text', delta: '\n\n（剛剛沒有成功產生修改，所以沒有「套用」按鈕；可以再說一次要怎麼改。）' })
  }

  let announced = ''
  const onModel = (model: string) => {
    if (model === announced) return
    announced = model
    emit({ type: 'model', id: model, label: modelLabel(model) })
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    const parts: Part[] = []
    try {
      for await (const chunk of streamGenerate(
        env,
        {
          systemInstruction: { parts: [{ text: prompt }] },
          contents,
          tools,
          generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
        },
        onRetry,
        preferredModel,
        onModel,
      )) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          parts.push(part)
          if (part.text && !part.thought) {
            emit({ type: 'text', delta: part.text })
            if (part.text.includes('套用')) saidApply = true
          }
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
    if (calls.length === 0) return finish()

    const responses: Part[] = []
    for (const call of calls) {
      const args = call.args ?? {}
      let response: Record<string, unknown>
      if (call.name === 'web_search' && searches >= MAX_SEARCHES) {
        // 一輪對話搜太多次又慢又耗額度：用手上的資料回答
        response = { error: `這一輪已經搜尋 ${MAX_SEARCHES} 次了，請用目前的資料回答，不夠的部分照實說還沒查到` }
      } else if (call.name === 'web_search') {
        searches += 1
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
          for (const r of found.results) if ('results' in r) for (const x of r.results) allowedLinks.set(linkKey(x.url), x.url)
          searched.push(...found.results)
        }
      } else if (call.name === 'find_free_time') {
        const day = visible.days.find((d) => d.date === args.date)
        emit({ type: 'status', text: '計算空檔…' })
        response = day
          ? {
              windows: freeWindows(day, {
                who: typeof args.who === 'string' ? args.who : undefined,
                after: typeof args.after === 'string' && /^\d{2}:\d{2}$/.test(args.after) ? args.after : undefined,
              }),
            }
          : { error: `旅程裡沒有 ${String(args.date)} 這一天` }
      } else if (call.name === 'propose_changes') {
        const normalized = normalizeOps(args.operations)
        const checked = checkAgentOps(normalized, allowedLinks)
        // 拿掉的連結要讓使用者看到，不要默默消失
        if (checked.notes.length) emit({ type: 'status', text: `有 ${checked.notes.length} 個地圖連結不是你給的網址，沒有存（請貼地圖 App 的分享連結）` })
        const parsed = opsSchema.safeParse(normalized)
        if (checked.problems.length) {
          response = { ok: false, errors: checked.problems }
        } else if (!parsed.success) {
          response = {
            ok: false,
            errors: Array.isArray(args.operations)
              ? parsed.error.issues.map((i) => `operations.${i.path.join('.')}：${i.message}`)
              : ['operations 要是一個陣列，至少放一個修改動作'],
          }
        } else {
          const applied = applyOps(stored.trip, parsed.data)
          const clashes = applied.errors.length ? [] : [...newOverlaps(stored.trip, applied.trip), ...transitLengthChanges(stored.trip, applied.trip)]
          if (applied.errors.length) {
            response = { ok: false, errors: applied.errors }
          } else if (clashes.length) {
            response = {
              ok: false,
              errors: clashes,
              hint: '請改用 insert_item 自動把後面的行程往後推，或改時間、用 who 只排給有空的人；要延後出發是改 time（結束時間會自動跟著移），不是拉長交通時間；固定行程不能動',
            }
          } else {
            emit({
              type: 'proposal',
              proposal: {
                id: crypto.randomUUID(),
                summary: String(args.summary ?? '修改行程'),
                ops: parsed.data,
                changes: applied.changes,
                baseVersion: stored.version,
                ...(mode === 'create' && { createTripId: typeof args.tripId === 'string' ? args.tripId : '' }),
              },
            })
            proposals += 1
            response = {
              ok: true,
              shownToUser: applied.changes.map((c) => c.text),
              note: '已顯示給使用者，等使用者按「套用」才會生效。',
              ...(checked.notes.length && { warnings: checked.notes }),
            }
          }
        }
        if (!response.ok) {
          console.log('proposal rejected', JSON.stringify(response.errors).slice(0, 1500))
          emit({ type: 'status', text: '修改內容有誤，重新調整中…' })
        }
      } else {
        response = { error: `沒有 ${call.name} 這個工具` }
      }
      responses.push({ functionResponse: { ...(call.id && { id: call.id }), name: call.name, response } })
    }
    contents.push({ role: 'user', parts: responses })
  }
  emit({ type: 'text', delta: '\n（步驟太多先停在這裡，可以再告訴我要繼續。）' })
  finish()
}
