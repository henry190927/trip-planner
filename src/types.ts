// 所有旅程共用的資料格式。新增一趟旅行 = 在 src/trips/ 新增一個符合 Trip 的檔案。

export type MapProvider = 'naver' | 'kakao' | 'google'

export interface Place {
  name: string
  /** 當地語言名稱（地圖搜尋、給當地人看） */
  local?: string
  address?: string
  /** 當地語言地址，「給司機看」全螢幕卡會用大字顯示 */
  addressLocal?: string[]
  /** 地圖搜尋字串；省略時用 local ?? name */
  mapQuery?: string
  /** 指定地圖連結（例如 Naver 的地點分享連結），優先於搜尋 */
  mapLink?: string
}

export type ItemKind =
  | 'flight'
  | 'transit'
  | 'stay'
  | 'food'
  | 'sight'
  | 'shopping'
  | 'concert'
  | 'task'

export interface Item {
  time?: string
  end?: string
  /** 時間不是旅程當地時區時填（例如出發地的起飛時間） */
  tzLabel?: string
  kind: ItemKind
  title: string
  place?: Place
  note?: string
  /** 連到「交通」分頁的某條路線 */
  routeId?: string
  /** 只是建議、尚未確定 */
  tentative?: boolean
  /** 出發前還要確認的事 */
  verify?: string
}

export interface Day {
  date: string
  title: string
  items: Item[]
}

export interface FlightEnd {
  code: string
  name: string
  terminal: string
  time: string
  tzLabel: string
}

export interface Flight {
  label: string
  date: string
  airline: string
  number: string
  aircraft?: string
  cabin?: string
  duration: string
  from: FlightEnd
  to: FlightEnd
  notes?: string[]
}

export interface Stay {
  place: Place
  checkIn: string
  checkOut: string
  notes?: string[]
  verify?: string
}

export interface RouteOption {
  label: string
  mode: string
  /** 分頁標籤用的短名稱，省略時用 mode */
  tab?: string
  recommended?: boolean
  duration: string
  cost: string
  steps: string[]
  pros?: string[]
  cons?: string[]
  verify?: string
}

export interface Route {
  id: string
  title: string
  when?: string
  summary: string
  options: RouteOption[]
  /** 出狀況時的備案 */
  fallback?: string[]
}

export interface Link {
  label: string
  url: string
}

export interface Tip {
  title: string
  body: string[]
  level?: 'info' | 'warn'
  links?: Link[]
}

export interface TipSection {
  title: string
  tips: Tip[]
}

export interface ChecklistGroup {
  title: string
  items: { id: string; label: string }[]
}

export interface Trip {
  id: string
  title: string
  subtitle: string
  emoji: string
  /** IANA 時區，用來判斷「現在」與倒數 */
  timezone: string
  startDate: string
  endDate: string
  theme: { accent: string; accent2: string }
  mapProvider: MapProvider
  /** 給司機看的卡片上方那句話（當地語言） */
  driverPhrase?: string
  flights: Flight[]
  stays: Stay[]
  days: Day[]
  routes: Route[]
  tips: TipSection[]
  checklist: ChecklistGroup[]
  /** 尚未提供的資料 */
  pending?: string[]
}
