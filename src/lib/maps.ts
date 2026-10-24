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

export function mapUrl(provider: MapProvider, place: Place) {
  return place.mapLink ?? builders[provider](place.mapQuery ?? place.local ?? place.name)
}
