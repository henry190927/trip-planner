import { z } from 'zod'

// 旅程資料的唯一規格：型別由這裡推導，資料檔的完整性由 src/trips/trips.test.ts 用它檢查。
// app 只 import 型別，所以 zod 不會進到前端 bundle。

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, '時間格式要是 HH:MM')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式要是 YYYY-MM-DD')

export const placeSchema = z.object({
  name: z.string(),
  /** 當地語言名稱（地圖搜尋、給當地人看） */
  local: z.string().optional(),
  address: z.string().optional(),
  /** 當地語言地址，「給司機看」全螢幕卡會用大字顯示 */
  addressLocal: z.array(z.string()).optional(),
  /** 地圖搜尋字串；省略時用 local ?? name */
  mapQuery: z.string().optional(),
  /** 指定地圖連結（例如 Naver 的地點分享連結），優先於搜尋 */
  mapLink: z.url().optional(),
})

export const itemKinds = ['flight', 'transit', 'stay', 'food', 'sight', 'shopping', 'concert', 'task'] as const

/** 什麼情況下啟用備案 */
export const triggers = ['full', 'closed', 'rain', 'tired', 'early', 'late', 'other'] as const

/** 行程項目的備案。啟用時跟目前的內容交換，所以原本的安排會變成一個 original 的備案，隨時能換回來 */
export const alternativeSchema = z.object({
  trigger: z.enum(triggers),
  /** 補充觸發條件，例如「排隊超過 30 分鐘」；trigger 是 other 時用來說明 */
  when: z.string().optional(),
  title: z.string(),
  kind: z.enum(itemKinds).optional(),
  /** 省略時沿用目前的時間 */
  time: hhmm.optional(),
  end: hhmm.optional(),
  place: placeSchema.optional(),
  spotId: z.string().optional(),
  routeId: z.string().optional(),
  note: z.string().optional(),
  /** 這是原本的安排（啟用過備案後才會出現） */
  original: z.boolean().optional(),
})

export const itemSchema = z.object({
  time: hhmm.optional(),
  end: hhmm.optional(),
  /** 時間不是旅程當地時區時填（例如出發地的起飛時間） */
  tzLabel: z.string().optional(),
  kind: z.enum(itemKinds),
  title: z.string(),
  /** 只有部分旅伴參加時填 traveler id；省略 = 全員 */
  who: z.array(z.string()).optional(),
  place: placeSchema.optional(),
  note: z.string().optional(),
  /** 連到「交通」分頁的某條路線 */
  routeId: z.string().optional(),
  /** 只是建議、尚未確定 */
  tentative: z.boolean().optional(),
  /** 出發前還要確認的事 */
  verify: z.string().optional(),
  /** 對應「地點」分頁的哪一個地點 */
  spotId: z.string().optional(),
  /** 時間不能動（班機、演唱會預設就是）；整段挪時間時不會移動它，也不會把別的項目推過它 */
  fixed: z.boolean().optional(),
  alternatives: z.array(alternativeSchema).optional(),
  /** 目前顯示的是因為什麼情況啟用的備案；省略 = 原本的安排 */
  usedAlternative: z
    .object({
      trigger: z.enum(triggers),
      when: z.string().optional(),
      /** 這個備案本來沒寫、啟用時沿用原本的欄位；換回去時不寫進備案，讓它繼續沿用 */
      inherited: z.array(z.enum(['kind', 'time', 'end'])).optional(),
    })
    .optional(),
})

export const scenes = ['depart', 'concert', 'stroll', 'home'] as const

export const daySchema = z.object({
  date: isoDate,
  title: z.string(),
  /** 每日頁首的插圖 */
  scene: z.enum(scenes),
  items: z.array(itemSchema),
})

const flightEndSchema = z.object({
  code: z.string(),
  name: z.string(),
  terminal: z.string(),
  time: hhmm,
  tzLabel: z.string(),
})

export const flightSchema = z.object({
  label: z.string(),
  date: isoDate,
  airline: z.string(),
  number: z.string(),
  aircraft: z.string().optional(),
  cabin: z.string().optional(),
  duration: z.string(),
  from: flightEndSchema,
  to: flightEndSchema,
  notes: z.array(z.string()).optional(),
})

export const staySchema = z.object({
  place: placeSchema,
  checkIn: z.string(),
  checkOut: z.string(),
  notes: z.array(z.string()).optional(),
  verify: z.string().optional(),
})

export const routeOptionSchema = z.object({
  label: z.string(),
  mode: z.string(),
  /** 分頁標籤用的短名稱，省略時用 mode */
  tab: z.string().optional(),
  recommended: z.boolean().optional(),
  duration: z.string(),
  cost: z.string(),
  steps: z.array(z.string()).min(1),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  verify: z.string().optional(),
})

export const routeSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** 這條路線是誰在走；省略 = 全員 */
  who: z.array(z.string()).optional(),
  when: z.string().optional(),
  summary: z.string(),
  options: z.array(routeOptionSchema).min(1),
  /** 出狀況時的備案 */
  fallback: z.array(z.string()).optional(),
})

export const linkSchema = z.object({ label: z.string(), url: z.url() })

export const tipSchema = z.object({
  title: z.string(),
  body: z.array(z.string()),
  level: z.enum(['info', 'warn']).optional(),
  links: z.array(linkSchema).optional(),
})

export const tipSectionSchema = z.object({ title: z.string(), tips: z.array(tipSchema) })

export const checklistGroupSchema = z.object({
  title: z.string(),
  items: z.array(z.object({ id: z.string(), label: z.string() })),
})

export const spotCategories = ['food', 'cafe', 'shopping', 'sight', 'other'] as const

/** 一段營業時間。to 小於等於 from 代表營業到隔天（例如 18:00–02:00）；整天營業寫 00:00–24:00 */
export const openRangeSchema = z.object({
  /** 0 = 星期日 … 6 = 星期六 */
  days: z.array(z.number().int().min(0).max(6)).min(1),
  from: hhmm,
  to: hhmm,
})

/** 「地點」分頁的一筆：已排進行程的地點，或還沒排的口袋名單 */
export const spotSchema = z.object({
  id: z.string(),
  place: placeSchema,
  category: z.enum(spotCategories),
  /** 所在地區，例如「弘大」，篩選與找同區備案用 */
  area: z.string().optional(),
  /** 顯示用的營業時間文字，例如「12:30–24:00（最後點餐 23:00）」 */
  hours: z.string().optional(),
  /** 判斷「現在營業中」用；沒有可靠資料就不要填 */
  open: z.array(openRangeSchema).optional(),
  /** 公休日說明 */
  closed: z.string().optional(),
  /** 怎麼去，例如「弘大入口站 9 號出口走路 3 分」 */
  access: z.string().optional(),
  tags: z.array(z.string()).optional(),
  note: z.string().optional(),
  /** 營業時間等資訊最後一次確認的日期 */
  checkedAt: isoDate.optional(),
  verify: z.string().optional(),
})

export const travelerSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** 這個人在畫面上的代表色（淺色底）與文字色 */
  color: z.string(),
  ink: z.string(),
})

export const tripSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  /** 代表插圖（不用系統 emoji，各平台長得不一樣） */
  icon: z.enum(['sprout', 'castle', 'plane']).optional(),
  /** IANA 時區，用來判斷「現在」與倒數 */
  timezone: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  mapProvider: z.enum(['naver', 'kakao', 'google']),
  /** 給司機看的卡片上方那句話（當地語言） */
  driverPhrase: z.string().optional(),
  travelers: z.array(travelerSchema).min(1),
  flights: z.array(flightSchema),
  stays: z.array(staySchema),
  days: z.array(daySchema).min(1),
  routes: z.array(routeSchema),
  tips: z.array(tipSectionSchema),
  checklist: z.array(checklistGroupSchema),
  /** 地點清單（含口袋名單） */
  spots: z.array(spotSchema).optional(),
  /** 尚未提供的資料 */
  pending: z.array(z.string()).optional(),
})

// ---- AI 能對行程做的修改動作 ----
// AI 不直接改整份資料，只能送出這幾種動作；套用後再整份用 tripSchema 驗證一次。

/** 修改既有項目時要改的欄位；值給 null 代表刪掉那個欄位 */
const itemChangesSchema = z
  .object({
    time: hhmm.nullable(),
    end: hhmm.nullable(),
    tzLabel: z.string().nullable(),
    kind: z.enum(itemKinds),
    title: z.string(),
    who: z.array(z.string()).nullable(),
    place: placeSchema.nullable(),
    note: z.string().nullable(),
    routeId: z.string().nullable(),
    tentative: z.boolean().nullable(),
    verify: z.string().nullable(),
    spotId: z.string().nullable(),
    fixed: z.boolean().nullable(),
  })
  .partial()

/** 修改既有地點時要改的欄位；值給 null 代表刪掉那個欄位 */
const spotChangesSchema = z
  .object({
    place: placeSchema,
    category: z.enum(spotCategories),
    area: z.string().nullable(),
    hours: z.string().nullable(),
    open: z.array(openRangeSchema).nullable(),
    closed: z.string().nullable(),
    access: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    note: z.string().nullable(),
    checkedAt: isoDate.nullable(),
    verify: z.string().nullable(),
  })
  .partial()

export const opSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add_item'), date: isoDate, item: itemSchema }),
  z.object({
    op: z.literal('update_item'),
    date: isoDate,
    /** 用目前的標題找項目；同一天有同名項目時再加 time 區分 */
    title: z.string(),
    time: hhmm.optional(),
    changes: itemChangesSchema,
  }),
  z.object({ op: z.literal('remove_item'), date: isoDate, title: z.string(), time: hhmm.optional() }),
  z.object({ op: z.literal('add_checklist_item'), group: z.string(), label: z.string() }),
  z.object({ op: z.literal('add_pending'), text: z.string() }),
  z.object({ op: z.literal('remove_pending'), text: z.string() }),
  /** 加進地點清單；id 省略時自動產生 */
  z.object({ op: z.literal('add_spot'), spot: spotSchema.extend({ id: z.string().optional() }) }),
  /** ref：地點的 id、名稱或當地語言名稱 */
  z.object({ op: z.literal('update_spot'), ref: z.string(), spotChanges: spotChangesSchema }),
  z.object({ op: z.literal('remove_spot'), ref: z.string() }),
  /** 幫行程項目加一個備案 */
  z.object({ op: z.literal('add_alternative'), date: isoDate, title: z.string(), time: hhmm.optional(), alternative: alternativeSchema.omit({ original: true }) }),
  /** index：第幾個備案（從 0 開始） */
  z.object({ op: z.literal('remove_alternative'), date: isoDate, title: z.string(), time: hhmm.optional(), index: z.number().int().min(0) }),
  /**
   * 把 from 開始的彈性項目整段挪動 minutes 分鐘（正數往後、負數往前），固定的項目不動。
   * 預設只挪到下一個固定行程之前；until 可以指定挪到幾點（不含）。who 只挪那位旅伴自己的項目（不含全員一起的）
   */
  z.object({
    op: z.literal('shift_items'),
    date: isoDate,
    from: hhmm,
    until: hhmm.optional(),
    minutes: z.number().int().min(-240).max(240).refine((n) => n !== 0, '不能是 0'),
    who: z.string().optional(),
  }),
  /** 啟用備案：跟目前的內容交換 */
  z.object({ op: z.literal('use_alternative'), date: isoDate, title: z.string(), time: hhmm.optional(), index: z.number().int().min(0) }),
])

export const opsSchema = z.array(opSchema).min(1).max(20)
