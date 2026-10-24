import { useEffect, useState } from 'react'
import type { Trip } from '../types'

export interface ZonedNow {
  date: string
  time: string
}

export function nowIn(timeZone: string): ZonedNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

export function useNow(timeZone: string) {
  const [now, setNow] = useState(() => nowIn(timeZone))
  useEffect(() => {
    const tick = () => setNow(nowIn(timeZone))
    tick()
    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [timeZone])
  return now
}

const dayMs = 86_400_000
const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`)

export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / dayMs)

const weekdays = '日一二三四五六'

export function formatDate(date: string, withWeekday = true) {
  const d = new Date(toUtc(date))
  const md = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  return withWeekday ? `${md}（${weekdays[d.getUTCDay()]}）` : md
}

export function weekday(date: string) {
  return weekdays[new Date(toUtc(date)).getUTCDay()]
}

export type TripPhase =
  | { kind: 'before'; days: number }
  | { kind: 'during'; dayIndex: number }
  | { kind: 'after' }

export function tripPhase(trip: Trip, today: string): TripPhase {
  const toStart = daysBetween(today, trip.startDate)
  if (toStart > 0) return { kind: 'before', days: toStart }
  if (daysBetween(trip.endDate, today) > 0) return { kind: 'after' }
  return { kind: 'during', dayIndex: -toStart }
}
