import { useEffect } from 'react'
import { AlertTriangle, ChevronDown, ExternalLink, Plane } from 'lucide-react'
import type { Flight, Trip } from '../types'
import { formatDate } from '../lib/time'
import { Card, Chip, MapButton, SectionTitle, Verify } from './ui'
import DriverCard from './DriverCard'

function FlightCard({ flight }: { flight: Flight }) {
  return (
    <Card className="overflow-hidden p-0">
      <div
        className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))' }}
      >
        <span>
          {flight.label}・{formatDate(flight.date)}
        </span>
        <span className="tabular-nums">{flight.number}</span>
      </div>
      <div className="flex items-center gap-3 px-4 pt-4">
        {[flight.from, flight.to].map((end, i) => (
          <div key={end.code} className={`flex-1 ${i === 1 ? 'order-3 text-right' : ''}`}>
            <p className="text-3xl font-black tracking-tight">{end.code}</p>
            <p className="text-xl font-bold tabular-nums">{end.time}</p>
            <p className="text-xs text-mute">
              {end.name} <span className="font-bold text-ink">{end.terminal}</span>
            </p>
            <p className="text-[11px] text-mute">{end.tzLabel}時間</p>
          </div>
        ))}
        <div className="order-2 flex flex-col items-center text-mute">
          <Plane className="size-5 text-accent" />
          <span className="mt-1 whitespace-nowrap text-[11px]">{flight.duration}</span>
        </div>
      </div>
      <div className="mx-4 mt-4 border-t border-dashed border-line" />
      <div className="px-4 py-3 text-xs text-mute">
        {flight.airline}
        {flight.aircraft && `・${flight.aircraft}`}
        {flight.cabin && `・${flight.cabin}`}
        {flight.notes?.map((n) => (
          <p key={n} className="mt-2 text-sm leading-relaxed text-ink">
            {n}
          </p>
        ))}
      </div>
    </Card>
  )
}

export default function InfoView({ trip }: { trip: Trip }) {
  useEffect(() => window.scrollTo({ top: 0 }), [])

  return (
    <div className="pt-1">
      {trip.pending?.length ? (
        <>
          <SectionTitle>還缺的資料</SectionTitle>
          <Card className="border border-amber-400/40">
            <ul className="space-y-2 text-sm leading-relaxed">
              {trip.pending.map((p) => (
                <li key={p} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  {p}
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}

      <SectionTitle>航班</SectionTitle>
      <div className="space-y-4">
        {trip.flights.map((f) => (
          <FlightCard key={f.number} flight={f} />
        ))}
      </div>

      <SectionTitle>住宿</SectionTitle>
      <div className="space-y-4">
        {trip.stays.map((s) => (
          <Card key={s.place.name}>
            <h3 className="text-lg font-bold">{s.place.name}</h3>
            {s.place.local && <p className="text-sm text-mute">{s.place.local}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-line/50 p-2.5">
                <p className="text-[11px] text-mute">Check-in</p>
                <p className="font-semibold">{s.checkIn}</p>
              </div>
              <div className="rounded-xl bg-line/50 p-2.5">
                <p className="text-[11px] text-mute">Check-out</p>
                <p className="font-semibold">{s.checkOut}</p>
              </div>
            </div>
            {s.place.addressLocal && (
              <div className="mt-3 select-all text-base font-semibold leading-snug">
                {s.place.addressLocal.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            )}
            {s.place.address && <p className="mt-1 text-xs text-mute">{s.place.address}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <MapButton provider={trip.mapProvider} place={s.place} />
              <DriverCard place={s.place} phrase={trip.driverPhrase} />
            </div>
            {s.notes && (
              <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-mute">
                {s.notes.map((n) => (
                  <li key={n}>・{n}</li>
                ))}
              </ul>
            )}
            {s.verify && <Verify>{s.verify}</Verify>}
          </Card>
        ))}
      </div>

      {trip.tips.map((section) => (
        <div key={section.title}>
          <SectionTitle>{section.title}</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {section.tips.map((tip) => (
              <details key={tip.title} className="group px-4 py-3.5">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{tip.title}</span>
                  {tip.level === 'warn' && <Chip tone="warn">重要</Chip>}
                  <ChevronDown className="size-4 text-mute transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-mute">
                  {tip.body.map((b) => (
                    <p key={b}>{b}</p>
                  ))}
                </div>
                {tip.links && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tip.links.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-3 py-1.5 text-xs font-semibold text-accent active:scale-95"
                      >
                        <ExternalLink className="size-3.5" />
                        {l.label}
                      </a>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </Card>
        </div>
      ))}
    </div>
  )
}
