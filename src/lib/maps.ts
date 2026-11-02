import type { MapProvider, Place } from '../types'

const builders: Record<MapProvider, (q: string) => string> = {
  naver: (q) => `https://map.naver.com/p/search/${encodeURIComponent(q)}`,
  kakao: (q) => `https://map.kakao.com/link/search/${encodeURIComponent(q)}`,
  google: (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
}

export const mapLabel: Record<MapProvider, string> = {
  naver: 'Naver Map',
  kakao: 'KakaoMap',
  google: 'Google Maps',
}

// 搜尋字串被填成網址時不能拿來搜，改用店名
const isUrl = (text?: string) => !!text && /^https?:\/\//i.test(text.trim())
const queryOf = (place: Place) => (isUrl(place.mapQuery) ? undefined : place.mapQuery) ?? place.local ?? place.name

/** 網頁版連結（電腦、或手機沒裝 App 時用） */
export function mapUrl(provider: MapProvider, place: Place) {
  return place.mapLink ?? builders[provider](queryOf(place))
}

// App 的專屬連結：手機上直接打開 App 並搜尋那個地點，不先經過網頁。
// Google Maps 的 api=1 網址本身在手機上就會開 App，不需要另外處理
const APP_NAME = 'io.github.henry190927.trip-planner'
const appBuilders: Partial<Record<MapProvider, (q: string) => string>> = {
  naver: (q) => `nmap://search?query=${encodeURIComponent(q)}&appname=${APP_NAME}`,
  kakao: (q) => `kakaomap://search?q=${encodeURIComponent(q)}`,
}

/** 有指定確切地點的連結（例如 Naver Map 的分享連結）；沒有的話按鈕只能用名稱搜尋 */
export const isExact = (place: Place) => !!place.mapLink

/** 搜尋時用的字（顯示給使用者看「會用什麼搜尋」） */
export const searchText = queryOf

/**
 * 手機上直接叫起地圖 App 的連結。Naver 的 App 連結沒有「用分享連結或地點 ID 打開某一間」的格式，
 * 只能用店名搜尋，所以有確切連結的也先用完整店名（含分店名）在 App 裡搜；
 * 確切連結留給沒裝 App 時開網頁、以及電腦上用
 */
export function mapAppUrl(provider: MapProvider, place: Place) {
  return appBuilders[provider]?.(queryOf(place))
}

export const isPhone = (ua: string) => /iPhone|iPad|iPod|Android/i.test(ua)
