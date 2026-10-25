import { useEffect, useState } from 'react'
import type { Trip } from '../types'
import { daysBetween } from './dates'

export { daysBetween, formatDate, weekday } from './dates'

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

export type TripPhase =
  | { kind: 'before'; days: number }
  | { kind: 'during'; dayIndex: number }
  | { kind: 'after' }

export function tripPhase(trip: Trip, today: string): TripPhase {
  const toStart = daysBetween(today, trip.startDate)
  if (toStart > 0) return { kind: 'before', days: toStart }
  if (daysBetween(trip.endDate, today) > 0) return { kind: 'after' }
  return { kind: 'during', dayIndex: daysBetween(trip.startDate, today) }
}
