// 搜尋結果的安全過濾。垃圾、詐騙、賭博、成人網站常在頁面塞滿熱門店名與關鍵字，
// 所以搜尋結果偶爾會混進來；這裡的結果會顯示成來源按鈕，也會交給模型讀。
//
// 依序：網址特徵 → 可疑字眼 → 與搜尋字詞的相關性（同步、便宜）→ 網域信譽（要連網，最後做）

/** 送出搜尋時就請 Tavily 排除 */
export const BLOCKED_DOMAINS = ['pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com', 'onlyfans.com', 'spankbang.com']

// 地圖與訂位網站的頁面標題常常不寫店名（例如只有「네이버 지도」），不做相關性檢查
const TRUSTED_DOMAINS = ['map.naver.com', 'place.naver.com', 'naver.me', 'map.kakao.com', 'place.map.kakao.com', 'google.com', 'catchtable.co.kr', 'tablelog.co.kr']

// 詐騙站常用的便宜網域
const SUSPICIOUS_TLD = /\.(xyz|top|click|icu|buzz|cyou|sbs|rest|bond|cfd|monster|quest|lol|loan|win|bet|casino|zip|mov|tk|ml|cf|ga|gq)$/

// 只看標題與網址：「성인」「成人」不列入，票價頁常用來指成人票
const ADULT = /porn|xvideo|xnxx|xhamster|redtube|youporn|spankbang|onlyfans|hentai|\bsex|\bxxx|야동|섹스|色情|情色|av女優/i

// 賭博、詐騙、借貸、色情按摩、藥物：正常的餐廳或景點頁面幾乎不會出現，連內文一起看
// 「오피스」「오피스텔」是一般用語，所以「오피」後面不能接「스」；「토토」是品牌名，只擋賭博站的說法
const SCAM =
  /카지노|바카라|토토사이트|사설토토|먹튀|슬롯사이트|홀덤|도박|파워볼|배팅|출장안마|출장마사지|오피(?!스)|휴게텔|급전|작업대출|무직자대출|비아그라|시알리스|필로폰|casino|baccarat|sports ?betting|gambl|payday loan|viagra|cialis|escort service|airdrop|free giveaway|賭場|博彩|娛樂城|百家樂|代辦貸款|威而鋼/i

// 這些字幾乎每個結果都有，不能拿來判斷相關性
const GENERIC = /^(홍대|홍대입구|서울|영업시간|예약|네이버|맛집|주소|위치|메뉴|가격|弘大|首爾|營業時間|地址|訂位|預約|價格|菜單|naver|map|seoul|hongdae|open|hours|menu|price|reservation)$/i

export interface RawResult {
  title?: string
  url?: string
  content?: string
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

const within = (host: string, domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`))

function keywords(query: string) {
  const words = query.toLowerCase().split(/[\s,，、/()（）「」]+/).filter((w) => w.length >= 2)
  const specific = words.filter((w) => !GENERIC.test(w))
  return specific.length ? specific : words
}

function decodeSafe(s: string) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** 不用連網就能判斷的部分：有問題的網站是 unsafe，跟搜尋字詞無關的是 irrelevant */
export function checkResult(query: string, r: RawResult): 'ok' | 'unsafe' | 'irrelevant' {
  if (!r.url || !/^https?:/.test(r.url)) return 'unsafe'
  const host = hostOf(r.url)
  if (!host || within(host, BLOCKED_DOMAINS)) return 'unsafe'
  // 直接用 IP 當網址、或是詐騙常用的網域
  if (/^[\d.]+$/.test(host) || host.startsWith('[') || SUSPICIOUS_TLD.test(host)) return 'unsafe'
  const url = decodeSafe(r.url)
  if (ADULT.test(`${r.title ?? ''} ${url}`)) return 'unsafe'
  if (SCAM.test(`${r.title ?? ''} ${url} ${r.content ?? ''}`)) return 'unsafe'
  if (within(host, TRUSTED_DOMAINS)) return 'ok'
  const haystack = `${r.title ?? ''} ${url} ${r.content ?? ''}`.toLowerCase()
  const words = keywords(query)
  return words.length === 0 || words.some((k) => haystack.includes(k)) ? 'ok' : 'irrelevant'
}

export const keepResult = (query: string, r: RawResult) => checkResult(query, r) === 'ok'

// ---- 網域信譽 ----
// Cloudflare 的家庭版 DNS（1.1.1.3）會把惡意軟體、釣魚、成人網站解析成 0.0.0.0，免費也不用金鑰。
// 查不到（逾時、DNS 服務出錯）時放行，靠上面的規則把關；網域不存在（NXDOMAIN）則擋掉。

const DOH = 'https://family.cloudflare-dns.com/dns-query'
const cache = new Map<string, { blocked: boolean; until: number }>()
const CACHE_MS = 60 * 60 * 1000

async function isBlockedHost(host: string): Promise<boolean> {
  const hit = cache.get(host)
  if (hit && hit.until > Date.now()) return hit.blocked
  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(host)}&type=A`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) throw new Error(`DoH ${res.status}`)
    const data = (await res.json()) as { Status?: number; Answer?: { type: number; data: string }[] }
    const blocked = data.Status === 3 || (data.Answer ?? []).some((a) => a.type === 1 && a.data === '0.0.0.0')
    cache.set(host, { blocked, until: Date.now() + CACHE_MS })
    return blocked
  } catch (e) {
    console.error('信譽檢查失敗，放行', host, e)
    return false
  }
}

/** 回傳被判定有問題的網域 */
export async function blockedHosts(hosts: string[]) {
  const unique = [...new Set(hosts)]
  const verdicts = await Promise.all(unique.map(isBlockedHost))
  return new Set(unique.filter((_, i) => verdicts[i]))
}
