import { useEffect } from 'react'
import { useRoute } from './lib/router'
import { getTrip } from './trips'
import TripList from './components/TripList'
import TripView from './components/TripView'

export default function App() {
  const route = useRoute()
  const trip = route.tripId ? getTrip(route.tripId) : undefined

  useEffect(() => {
    document.title = trip ? `${trip.title}・旅行手帖` : '旅行手帖'
  }, [trip])

  if (!trip) return <TripList />
  return <TripView key={trip.id} trip={trip} tab={route.tab} focus={route.focus} />
}
