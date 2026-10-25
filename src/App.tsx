import { useEffect } from 'react'
import { useRoute } from './lib/router'
import { useTrip, useTrips } from './lib/tripStore'
import TripList from './components/TripList'
import TripView from './components/TripView'

export default function App() {
  const route = useRoute()
  const trip = useTrip(route.tripId)
  const refresh = useTrips((s) => s.refresh)

  // 打開網站、或從背景切回來時，抓一次最新的行程
  useEffect(() => {
    void refresh()
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  useEffect(() => {
    document.title = trip ? `${trip.title}・旅行手帖` : '旅行手帖'
  }, [trip])

  if (!trip) return <TripList />
  return <TripView key={trip.id} trip={trip} tab={route.tab} focus={route.focus} />
}
